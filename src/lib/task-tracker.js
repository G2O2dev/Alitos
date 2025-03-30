export class TaskTracker {
    // Разделяем очереди на последовательные и параллельные задачи.
    #sequentialQueue = [];
    #parallelQueue = [];
    #runningSequential = false;
    #parallelPromises = [];
    // Для активных задач используем Map, где ключ – уникальный id задачи.
    #activeTasks = new Map();
    #events = {};
    // Флаг, указывающий, что обработка задач уже запущена.
    #isRunning = false;

    // Метрики для профилирования
    #metrics = {
        totalTasks: 0,
        totalExecutionTime: 0
    };

    // Счётчик для генерации уникальных идентификаторов задач.
    #taskIdCounter = 0;

    /**
     * Конструктор принимает опциональный массив задач.
     * Каждая задача – объект с полями:
     * - method: функция, выполняющая задачу (синхронная или возвращающая Promise).
     * - callback: (опционально) функция, вызываемая после выполнения задачи.
     * - info: (опционально) дополнительная информация.
     * - priority: (опционально, по умолчанию false) если true – задача имеет высокий приоритет.
     * - parallel: (опционально, по умолчанию false) если true – задача будет выполнена параллельно.
     * - useWorker: (опционально, по умолчанию false) если true – задача будет выполнена в Web Worker.
     */
    constructor(tasks = []) {
        if (tasks.length > 0) {
            this.addTasks(tasks);
        }
    }

    /**
     * Подписка на события.
     * События:
     * - 'start': начало выполнения задач.
     * - 'taskStart': начало выполнения конкретной задачи.
     * - 'taskEnd': завершение задачи.
     * - 'taskCancelled': отмена задачи.
     * - 'finish': когда все задачи завершены.
     * @param {string} event Название события.
     * @param {function} listener Обработчик события.
     */
    on(event, listener) {
        if (!this.#events[event]) {
            this.#events[event] = [];
        }
        this.#events[event].push(listener);
    }

    /**
     * Генерация события с передачей данных.
     * @param {string} event Название события.
     * @param {*} data Данные для обработчиков.
     */
    emit(event, data) {
        if (this.#events[event]) {
            this.#events[event].forEach(listener => listener(data));
        }
    }

    /**
     * Добавление одной задачи. Если передана функция – оборачиваем её в объект.
     * Для каждой задачи назначается уникальный идентификатор.
     * Если не указан AbortController – создаём его для поддержки отмены.
     * Задачи распределяются по очередям в зависимости от флага parallel.
     * Приоритетная задача вставляется в очередь после уже существующих приоритетных.
     * @param {function|object} task Функция задачи или объект задачи.
     */
    addTask(task) {
        if (typeof task === 'function') {
            task = { method: task };
        }
        // Гарантируем наличие callback и info, а также устанавливаем флаги по умолчанию.
        task.callback = task.callback || (() => {});
        task.info = task.info || {};
        task.priority = task.priority || false;
        task.parallel = task.parallel || false;
        task.useWorker = task.useWorker || false;

        // Добавляем AbortController для поддержки отмены, если его ещё нет.
        if (!task.abortController) {
            task.abortController = new AbortController();
        }
        task.abortSignal = task.abortController.signal;

        // Назначаем уникальный id.
        task.id = ++this.#taskIdCounter;

        // Вставляем задачу в соответствующую очередь с учётом приоритета.
        const insertTask = (queue) => {
            if (task.priority) {
                // Ищем последний элемент с приоритетом.
                let idx = -1;
                for (let i = queue.length - 1; i >= 0; i--) {
                    if (queue[i].priority) {
                        idx = i;
                        break;
                    }
                }
                if (idx === -1) {
                    queue.unshift(task);
                } else {
                    queue.splice(idx + 1, 0, task);
                }
            } else {
                queue.push(task);
            }
        };

        if (task.parallel) {
            insertTask(this.#parallelQueue);
        } else {
            insertTask(this.#sequentialQueue);
        }

        // Запускаем выполнение задач, если оно ещё не запущено.
        this.run();
    }

    /**
     * Добавление массива задач.
     * @param {Array} tasks Массив задач (функций или объектов).
     */
    addTasks(tasks) {
        tasks.forEach(task => this.addTask(task));
    }

    /**
     * Метод для получения активных задач (выполняемых или ожидающих выполнения).
     * @returns {Array} Копия активных задач.
     */
    getActiveTasks() {
        return Array.from(this.#activeTasks.values());
    }

    /**
     * Метод отмены задачи по её id.
     * Если задача ещё в очереди – удаляет её.
     * Если задача активна и поддерживает отмену – вызывает abort.
     * @param {number} taskId Идентификатор задачи.
     * @returns {boolean} true, если задача была отменена, иначе false.
     */
    cancelTask(taskId) {
        // Поиск в последовательной очереди.
        let idx = this.#sequentialQueue.findIndex(task => task.id === taskId);
        if (idx !== -1) {
            const [task] = this.#sequentialQueue.splice(idx, 1);
            this.emit('taskCancelled', task);
            return true;
        }
        // Поиск в параллельной очереди.
        idx = this.#parallelQueue.findIndex(task => task.id === taskId);
        if (idx !== -1) {
            const [task] = this.#parallelQueue.splice(idx, 1);
            this.emit('taskCancelled', task);
            return true;
        }
        // Если задача уже выполняется – инициируем отмену через AbortController (если поддерживается).
        if (this.#activeTasks.has(taskId)) {
            const task = this.#activeTasks.get(taskId);
            if (task.abortController) {
                task.abortController.abort();
                this.emit('taskCancelled', task);
                return true;
            }
        }
        return false;
    }

    /**
     * Основной метод выполнения задач.
     * Запускает обработку последовательных и параллельных очередей до полного опустошения.
     * Событие 'finish' вызывается только один раз, когда все задачи завершены.
     */
    async run() {
        if (this.#isRunning) return;
        this.#isRunning = true;
        this.emit('start');

        // Цикл продолжается, пока есть задачи в очередях или активные задачи.
        while (
            this.#sequentialQueue.length > 0 ||
            this.#parallelQueue.length > 0 ||
            this.#activeTasks.size > 0
            ) {
            await Promise.all([this.#runSequential(), this.#runParallel()]);
        }
        this.#isRunning = false;
        this.emit('finish');
    }

    /**
     * Выполнение последовательных задач по очереди.
     */
    async #runSequential() {
        if (this.#runningSequential) return;
        this.#runningSequential = true;
        while (this.#sequentialQueue.length > 0) {
            const task = this.#sequentialQueue.shift();
            // Добавляем задачу в активные.
            this.#activeTasks.set(task.id, task);
            this.emit('taskStart', task);
            const startTime = performance.now();
            try {
                let result;
                if (task.useWorker) {
                    result = await this.#runTaskInWorker(task);
                } else {
                    result = task.method(task.info, task.abortSignal);
                    if (result instanceof Promise) {
                        result = await result;
                    }
                }
                task.callback(result, task.info);
                this.emit('taskEnd', { task, result });
            } catch (error) {
                this.emit('taskEnd', { task, error });
            } finally {
                const execTime = performance.now() - startTime;
                this.#metrics.totalExecutionTime += execTime;
                this.#metrics.totalTasks++;
                this.#activeTasks.delete(task.id);
            }
        }
        this.#runningSequential = false;
    }

    /**
     * Выполнение параллельных задач.
     */
    async #runParallel() {
        while (this.#parallelQueue.length > 0) {
            const task = this.#parallelQueue.shift();
            this.#activeTasks.set(task.id, task);
            this.emit('taskStart', task);
            const startTime = performance.now();
            const p = (async () => {
                try {
                    let result;
                    if (task.useWorker) {
                        result = await this.#runTaskInWorker(task);
                    } else {
                        result = task.method(task.info, task.abortSignal);
                        if (result instanceof Promise) {
                            result = await result;
                        }
                    }
                    task.callback(result, task.info);
                    this.emit('taskEnd', { task, result });
                } catch (error) {
                    this.emit('taskEnd', { task, error });
                } finally {
                    const execTime = performance.now() - startTime;
                    this.#metrics.totalExecutionTime += execTime;
                    this.#metrics.totalTasks++;
                    this.#activeTasks.delete(task.id);
                }
            })();
            this.#parallelPromises.push(p);
        }
        await Promise.all(this.#parallelPromises);
        this.#parallelPromises = [];
    }

    /**
     * Выполнение задачи в Web Worker.
     * Функция задачи сериализуется и выполняется в воркере.
     * Обратите внимание, что для отмены задача в воркере не поддерживается.
     * @param {object} task Задача для выполнения.
     * @returns {Promise} Результат выполнения задачи.
     */
    async #runTaskInWorker(task) {
        const functionString = task.method.toString();
        const workerScript = `
            self.onmessage = async function(e) {
                const info = e.data.info;
                const taskFunc = ${functionString};
                let result = taskFunc(info);
                if (result instanceof Promise) {
                    result = await result;
                }
                self.postMessage({ result });
            };
        `;
        const blob = new Blob([workerScript], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const worker = new Worker(url);
        return new Promise((resolve, reject) => {
            worker.onmessage = function(e) {
                resolve(e.data.result);
                worker.terminate();
                URL.revokeObjectURL(url);
            };
            worker.onerror = function(e) {
                reject(e);
                worker.terminate();
                URL.revokeObjectURL(url);
            };
            worker.postMessage({ info: task.info });
        });
    }

    /**
     * Получение метрик выполнения задач.
     * @returns {object} Объект с общим числом задач, суммарным временем выполнения и средней длительностью.
     */
    getMetrics() {
        return {
            ...this.#metrics,
            averageExecutionTime: this.#metrics.totalTasks
                ? this.#metrics.totalExecutionTime / this.#metrics.totalTasks
                : 0
        };
    }
}
