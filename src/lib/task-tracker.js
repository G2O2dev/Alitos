export class TaskTracker {
    #queue = [];
    #running = false;
    #events = {};

    /**
     * Конструктор принимает опциональный массив задач.
     * Каждая задача – объект с полями:
     * - method: функция, которая выполняет задачу. Может быть синхронной или возвращать Promise.
     * - callback: (опционально) функция, вызываемая после выполнения задачи.
     * - info: (опционально) дополнительная информация о задаче.
     */
    constructor(tasks = []) {
        if (tasks.length > 0) {
            this.addTasks(tasks);
        }
    }

    /**
     * Подписка на события.
     * События:
     * - 'start': когда начинается выполнение очереди задач.
     * - 'taskStart': когда начинается выполнение конкретной задачи.
     * - 'taskEnd': когда задача завершена.
     * - 'finish': когда все задачи завершены.
     * @param {string} event Название события.
     * @param {function} listener Функция-обработчик события.
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
     * @param {*} data Данные, передаваемые обработчикам.
     */
    emit(event, data) {
        if (this.#events[event]) {
            this.#events[event].forEach(listener => listener(data));
        }
    }

    /**
     * Добавление одной задачи.
     * Если передана функция, она оборачивается в объект задачи.
     * @param {function|object} task Функция задачи или объект задачи.
     */
    addTask(task) {
        // Если task — функция, оборачиваем её в объект задачи.
        if (typeof task === 'function') {
            task = { method: task };
        }
        // Гарантируем наличие callback и info
        task.callback = task.callback || (() => {});
        task.info = task.info || {};
        this.#queue.push(task);
        this.run(); // Если таскер не занят, начинаем выполнение задач
    }

    /**
     * Добавление массива задач.
     * @param {Array} tasks Массив задач (каждая может быть функцией или объектом задачи).
     */
    addTasks(tasks) {
        tasks.forEach(task => this.addTask(task));
    }

    /**
     * Основной метод выполнения задач из очереди.
     * Задачи выполняются последовательно, с поддержкой асинхронных функций.
     */
    async run() {
        // Если уже выполняется, выходим, чтобы не запускать параллельное выполнение
        if (this.#running) return;
        this.#running = true;
        this.emit('start');

        // Обработка очереди задач
        while (this.#queue.length) {
            const task = this.#queue.shift();
            this.emit('taskStart', task);
            try {
                // Выполняем метод задачи, передавая в него дополнительную информацию
                let result = task.method(task.info);
                // Если возвращается Promise, ожидаем его завершения
                if (result instanceof Promise) {
                    result = await result;
                }
                // Вызываем callback, если он указан
                task.callback(result, task.info);
                this.emit('taskEnd', { task, result });
            } catch (error) {
                console.error('Ошибка при выполнении задачи:', error);
                this.emit('taskEnd', { task, error });
            }
        }

        this.#running = false;
        this.emit('finish');
    }
}