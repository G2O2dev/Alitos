export class TaskTracker {
    #sequentialQueue = [];
    #parallelQueue = [];
    #runningSequential = false;
    #activeTasks = new Map();
    #events = {};
    #isRunning = false;
    #metrics = { totalTasks: 0, totalExecutionTime: 0 };
    #taskIdCounter = 0;

    constructor(tasks = []) {
        if (tasks.length) this.addTasks(tasks);
    }

    on(event, listener) {
        if (!this.#events[event]) this.#events[event] = [];
        this.#events[event].push(listener);
    }
    off(event, listener) {
        if (!this.#events[event]) return;
        this.#events[event] = this.#events[event].filter(l => l !== listener);
    }
    emit(event, data) {
        if (this.#events[event]) {
            this.#events[event].forEach(listener => listener(data));
        }
    }

    addTask(task) {
        if (typeof task === 'function') task = { method: task };
        task.callback = task.callback || (() => {});
        task.info = task.info || {};
        task.priority = task.priority || false;
        task.parallel = task.parallel || false;
        task.useWorker = task.useWorker || false;
        if (!task.abortController) task.abortController = new AbortController();
        task.abortSignal = task.abortController.signal;
        task.id = ++this.#taskIdCounter;

        const promise = new Promise((resolve, reject) => {
            task.resolve = resolve;
            task.reject = reject;
        });
        task.awaitPromise = promise;
        promise.task = task;

        const insertTask = queue => {
            if (task.priority) {
                let idx = -1;
                for (let i = queue.length - 1; i >= 0; i--) {
                    if (queue[i].priority) { idx = i; break; }
                }
                (idx === -1 ? queue.unshift(task) : queue.splice(idx + 1, 0, task));
            } else {
                queue.push(task);
            }
        };

        task.parallel ? insertTask(this.#parallelQueue) : insertTask(this.#sequentialQueue);
        this.run();

        return promise;
    }

    addTasks(tasks) {
        return tasks.map(task => this.addTask(task));
    }

    getActiveTasks() {
        return Array.from(this.#activeTasks.values());
    }

    cancelTask(taskId) {
        let idx = this.#sequentialQueue.findIndex(task => task.id === taskId);
        if (idx !== -1) {
            const [task] = this.#sequentialQueue.splice(idx, 1);
            if (task.reject) task.reject(new Error('Task cancelled'));
            this.emit('taskCancelled', task);
            return true;
        }
        idx = this.#parallelQueue.findIndex(task => task.id === taskId);
        if (idx !== -1) {
            const [task] = this.#parallelQueue.splice(idx, 1);
            if (task.reject) task.reject(new Error('Task cancelled'));
            this.emit('taskCancelled', task);
            return true;
        }
        if (this.#activeTasks.has(taskId)) {
            const task = this.#activeTasks.get(taskId);
            if (task.abortController) {
                task.abortController.abort();
                if (task.reject) task.reject(new Error('Task cancelled'));
                this.emit('taskCancelled', task);
                return true;
            }
        }
        return false;
    }

    run() {
        if (!this.#isRunning) {
            this.#isRunning = true;
            this.emit('start');
        }
        if (!this.#runningSequential && this.#sequentialQueue.length > 0) {
            this.#runSequential();
        }
        if (this.#parallelQueue.length > 0) {
            this.#runParallel();
        }
        if (!this.#sequentialQueue.length && !this.#parallelQueue.length && !this.#activeTasks.size) {
            this.#isRunning = false;
            this.emit('finish');
        }
    }

    async #runSequential() {
        if (this.#runningSequential) return;
        this.#runningSequential = true;
        while (this.#sequentialQueue.length) {
            const task = this.#sequentialQueue.shift();
            this.#activeTasks.set(task.id, task);
            this.emit('taskStart', task);
            const startTime = performance.now();
            try {
                let result = task.useWorker ? await this.#runTaskInWorker(task) : task.method(task.info, task.abortSignal);
                if (result instanceof Promise) result = await result;
                // Вызов callback для совместимости
                task.callback(result, task.info);
                // Разрешаем промис, если await использовался
                this.#activeTasks.delete(task.id);
                task.resolve(result);
                this.emit('taskEnd', { task, result });
            } catch (error) {
                this.#activeTasks.delete(task.id);
                task.reject(error);
                this.emit('taskEnd', { task, error });
            } finally {
                this.#metrics.totalExecutionTime += performance.now() - startTime;
                this.#metrics.totalTasks++;
                this.run();
            }
        }
        this.#runningSequential = false;
    }

    async #runParallel() {
        while (this.#parallelQueue.length) {
            const task = this.#parallelQueue.shift();
            this.#activeTasks.set(task.id, task);
            this.emit('taskStart', task);
            const startTime = performance.now();
            (async () => {
                try {
                    let result = task.useWorker ? await this.#runTaskInWorker(task) : task.method(task.info, task.abortSignal);
                    if (result instanceof Promise) result = await result;
                    task.callback(result, task.info);
                    this.#activeTasks.delete(task.id);
                    task.resolve(result);
                    this.emit('taskEnd', { task, result });
                } catch (error) {
                    this.#activeTasks.delete(task.id);
                   task.reject(error);
                    this.emit('taskEnd', { task, error });
                } finally {
                    this.#metrics.totalExecutionTime += performance.now() - startTime;
                    this.#metrics.totalTasks++;
                    this.run();
                }
            })();
        }
    }

    async #runTaskInWorker(task) {
        const functionString = task.method.toString();
        const workerScript = `
            self.onmessage = async function(e) {
                const info = e.data.info;
                const taskFunc = ${functionString};
                let result = taskFunc(info);
                if (result instanceof Promise) result = await result;
                self.postMessage({ result });
            };
        `;
        const blob = new Blob([workerScript], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const worker = new Worker(url);
        return new Promise((resolve, reject) => {
            worker.onmessage = e => {
                resolve(e.data.result);
                worker.terminate();
                URL.revokeObjectURL(url);
            };
            worker.onerror = e => {
                reject(e);
                worker.terminate();
                URL.revokeObjectURL(url);
            };
            worker.postMessage({ info: task.info });
        });
    }

    getMetrics() {
        return {
            ...this.#metrics,
            averageExecutionTime: this.#metrics.totalTasks ? this.#metrics.totalExecutionTime / this.#metrics.totalTasks : 0
        };
    }
}