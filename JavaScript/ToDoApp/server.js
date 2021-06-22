/* eslint-disable no-console */
//import standard libs of Node.js
const { existsSync, readFileSync, writeFileSync } = require('fs');
const { createServer } = require('http');

// database file
const DB_FILE = './db.json';
// URI prefix for every method
const URI_PREFIX = '/api/todos';

const PORT = 3000;

/**
 * Error class for sending a response with status and desc
 */
class TodoApiError extends Error {
  constructor(statusCode, data) {
    super();
    this.statusCode = statusCode;
    this.data = data;
  }
}

/**
 * Asynchronically reads body of a request and parses it like a JSON
 * @param {Object} req - Object of a HTTP request
 * @throws {TodoApiError} Incorrect argument data
 * @returns {Object} Object that is created from a request body 
 */
function drainJson(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      resolve(JSON.parse(data));
    });
  });
}

/**
 * Checks input data and creates a correct task object
 * @param {Object} data - Object with data
 * @throws {TodoApiError} Incorrect argument data (statusCode 422)
 * @returns {{ name: string, owner: string, done: boolean }} Task object
 */
function makeTodoItemFromData(data) {
  const errors = [];

  // creating object where all fields are present
  const todoItem = {
    owner: data.owner && String(data.owner),
    name: data.name && String(data.name),
    done: Boolean(data.done),
  };

  // checking if all data is correct and filling error messages if not 
  if (!todoItem.owner) errors.push({ field: 'owner', message: 'There is no owner' });
  if (!todoItem.name) errors.push({ field: 'name', message: 'There is no Task title' });
  if (!todoItem.done) todoItem.done = false;

  // if errors are found , then throws 442 error
  if (errors.length) throw new TodoApiError(422, { errors });

  return todoItem;
}

/**
 * returns to do list from db
 * @param {{ owner: string }} [params] - tasks owner filter
 * @returns {{ name: string, owner: string, done: boolean }[]} tasks array
 */
function getTodoList(params = {}) {
  const todoList = JSON.parse(readFileSync(DB_FILE) || '[]');
  if (params.owner) return todoList.filter(({ owner }) => owner === params.owner);
  return todoList;
}

/**
 * Creates and saves task to db
 * @throws {TodoApiError} Incorrect argument data,task is not created (statusCode 422)
 * @param {Object} data - data form a request body
 * @returns {{ name: string, owner: string, done: boolean }} Task object
 */
function createTodoItem(data) {
  const newItem = makeTodoItemFromData(data);
  newItem.id = Date.now().toString();
  writeFileSync(DB_FILE, JSON.stringify([...getTodoList(), newItem]), { encoding: 'utf8' });
  return newItem;
}

/**
 * returns task object by id
 * @param {string} itemId - task id
 * @throws {TodoApiError} task with this id is not found (statusCode 404)
 * @returns {{ name: string, owner: string, done?: boolean }} task object
 */
function getTodoItem(itemId) {
  const todoItem = getTodoList().find(({ id }) => id === itemId);
  if (!todoItem) throw new TodoApiError(404, { message: 'TODO Item Not Found' });
  return todoItem;
}

/**
 * changes task with ID and saves changes to db
 * @param {string} itemId - task id
 * @param {{ name?: string, owner?: string, done?: boolean }} data - object with changable data
 * @throws {TodoApiError} Task with this id is not found  (statusCode 404)
 * @throws {TodoApiError} Incorrect argument data (statusCode 422)
 * @returns {{ name: string, owner: string, done?: boolean }} task object
 */
function updateTodoItem(itemId, data) {
  const todoItems = getTodoList();
  const itemIndex = todoItems.findIndex(({ id }) => id === itemId);
  if (itemIndex === -1) throw new TodoApiError(404, { message: 'TODO Item Not Found' });
  Object.assign(todoItems[itemIndex], makeTodoItemFromData({ ...todoItems[itemIndex], ...data }));
  writeFileSync(DB_FILE, JSON.stringify(todoItems), { encoding: 'utf8' });
  return todoItems[itemIndex];
}

/**
 * deletes task from db
 * @param {string} itemId - task id
 * @returns {{}}
 */
function deleteTodoItem(itemId) {
  const todoItems = getTodoList();
  const itemIndex = todoItems.findIndex(({ id }) => id === itemId);
  if (itemIndex === -1) throw new TodoApiError(404, { message: 'TODO Item Not Found' });
  todoItems.splice(itemIndex, 1);
  writeFileSync(DB_FILE, JSON.stringify(todoItems), { encoding: 'utf8' });
  return {};
}

// creates db file if it does not exist
if (!existsSync(DB_FILE)) writeFileSync(DB_FILE, '[]', { encoding: 'utf8' });

// creating HTTP server
createServer(async (req, res) => {
  // req - object with request information, res - object for controlling a response

  // This header means that body of a response will be in JSON format
  res.setHeader('Content-Type', 'application/json');

  // CORS response headers for cross-domen browser support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // browser can automatically send request with OPTIONS method in order to check CORS headers
  // in that case reponse with empty body and these headers is enough
  if (req.method === 'OPTIONS') {
    // end = end response creating and send it to a client
    res.end();
    return;
  }

  // if URI does not begin with required prefix, send 404
  if (!req.url || !req.url.startsWith(URI_PREFIX)) {
    res.statusCode = 404;
    res.end(JSON.stringify({ message: 'Not Found' }));
    return;
  }

  // remove URI prefix from a request and split it by paths and paramsубираем
  const [uri, query] = req.url.substr(URI_PREFIX.length).split('?');
  const queryParams = {};

  // params can be absent or be like a=b&b=c
  // in the second case filling object queryParams { a: 'b', b: 'c' }
  if (query) {
    for (const piece of query.split('&')) {
      const [key, value] = piece.split('=');
      queryParams[key] = value ? decodeURIComponent(value) : '';
    }
  }

  try {
    // processing request and preparing response body
    const body = await (async () => {
      if (uri === '' || uri === '/') {
        // /api/todos
        if (req.method === 'GET') return getTodoList(queryParams);
        if (req.method === 'POST') {
          const newTodoItem = createTodoItem(await drainJson(req));
          res.statusCode = 201;
          res.setHeader('Location', `${URI_PREFIX}/${newTodoItem.id}`);
          return newTodoItem;
        }
      } else {
        // /api/todos/{id}
        // param {id} from request URI
        const itemId = uri.substr(1);
        if (req.method === 'GET') return getTodoItem(itemId);
        if (req.method === 'PATCH') return updateTodoItem(itemId, await drainJson(req));
        if (req.method === 'DELETE') return deleteTodoItem(itemId);
      }
      return null;
    })();
    res.end(JSON.stringify(body));
  } catch (err) {
    // processing generated errors
    if (err instanceof TodoApiError) {
      res.writeHead(err.statusCode);
      res.end(JSON.stringify(err.data));
    } else {
      // if smth went wrong,write about it in console and return 500 server error
      res.statusCode = 500;
      res.end(JSON.stringify({ message: 'Server Error' }));
      console.error(err);
    }
  }
})
// output instruction when server starts
  .on('listening', () => {
    console.log(`Server TODO has been started. You can access it via http://localhost:${PORT}`);
    console.log('Press CTRL+C to stop server');
    console.log('Available methods:');
    console.log(`GET ${URI_PREFIX} - get task list, query param owner filters by owner`);
    console.log(`POST ${URI_PREFIX} - create task, in the task body object should be passed { name: string, owner: string, done?: boolean }`);
    console.log(`GET ${URI_PREFIX}/{id} - get task with ID`);
    console.log(`PATCH ${URI_PREFIX}/{id} - change task with ID, in the task body object should be passed { name?: string, owner?: string, done?: boolean }`);
    console.log(`DELETE ${URI_PREFIX}/{id} - delete task with ID`);
  })
// ...invoke server start on the defined port
  .listen(PORT);
