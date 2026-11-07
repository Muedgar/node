const http = require('http');

class Todo {
    id;
    title = null;
    isComplete = null;
    createdAt = null;
    updatedAt = null;

    setData(id, title, isComplete) {
        console.log('id:', id, 'title:', title, 'isComplete:', isComplete);

        this.id = id;
        this.title = title;
        this.isComplete = isComplete;
        this.createdAt = new Date();
    }

    updateData(title, isComplete) {
        const now = new Date();

        if (title !== undefined) {
            this.title = title;
            this.updatedAt = now;
        }

        if (isComplete !== undefined) {
            this.isComplete = isComplete;
            this.updatedAt = now;
        }
    }

    getData() {
        return {
            id: this.id,
            title: this.title,
            isComplete: this.isComplete,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

const todos = [];

function sendJson(res, status, payload, extraHeaders) {
    const body = JSON.stringify(payload, null, 2);

    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        ...extraHeaders
    });

    res.end(body);
}

const server = http.createServer((req, res) => {
    const todo = [];

    console.log('Request method', req.method);
    console.log('Url', req.url);

    req.on('data', chunk => {
        todo.push(chunk);
    });

    req.on('end', () => {
        const segments = req.url.split('/').filter(Boolean);

        // Get todos
        if (req.method === 'GET' && req.url === '/todos') {
            // filter for createdAt and updatedAt, and order by title.

            // pagination
            sendJson(res, 200, todos);
            return;
        }

        // Get one /todos/:id
        if (
            req.method === 'GET' &&
            segments.length === 2 &&
            segments[0] === 'todos'
        ) {
            const id = Number(segments[1]);

            const foundTodo = todos.find(
                todo => todo.getData().id === id
            );

            if (!foundTodo) {
                sendJson(res, 404, { data: 'Todo not found' });
                return;
            }

            sendJson(res, 200, foundTodo.getData());
            return;
        }

        // Update
        if (
            (req.method === 'PATCH' || req.method === 'PUT') &&
            segments.length === 2 &&
            segments[0] === 'todos'
        ) {
            const processedTodo = JSON.parse(
                Buffer.concat(todo).toString()
            );

            const id = Number(segments[1]);

            const foundTodo = todos.find(
                todo => todo.getData().id === id
            );

            if (!foundTodo) {
                sendJson(res, 404, { data: 'Todo not found' });
                return;
            }

            const title = processedTodo.title;
            const isComplete = processedTodo.isComplete;

            foundTodo.updateData(title, isComplete);

            sendJson(res, 200, foundTodo.getData());
            return;
        }

        // Delete

        // Create todo
        if (req.method === 'POST' && req.url === '/todos') {
            const processedTodo = JSON.parse(
                Buffer.concat(todo).toString()
            );

            console.log('payload:', processedTodo);

            const newTodo = new Todo();

            newTodo.setData(
                processedTodo.id,
                processedTodo.title,
                processedTodo.isComplete
            );

            const foundTodo = todos.find(
                todo => todo.getData().id === newTodo.getData().id
            );

            if (foundTodo) {
                sendJson(res, 409, {
                    data: 'Todo already exists.'
                });
                return;
            }

            console.log('storing this todo:', newTodo.getData());

            todos.push(newTodo);

            sendJson(res, 200, newTodo.getData());
            return;
        }
    });
});

server.listen(9000, '127.0.0.1');