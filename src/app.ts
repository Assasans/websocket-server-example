import Logger, { registerLoggers } from './helper/logger';
registerLoggers();

import * as fs from 'promise-fs';
import * as chalk from 'chalk';
import * as http from 'http';
import * as path from 'path';

import { Gateway } from './websocket';

const server: http.Server = http.createServer(async (request: http.IncomingMessage, response: http.ServerResponse) => {
	Logger.web.trace(`[${chalk.green.bold(request.connection.remoteAddress)}]: ${chalk.yellow(request.method)} ${chalk.green(request.url)}`);

	response.setHeader('Access-Control-Allow-Origin', '*');
	response.end(await fs.readFile(path.resolve('public', 'index.html')));
});

server.listen(2012, '0.0.0.0');
    
Logger.preinit.info(`Starting WebSocket server...`);
const gateway: Gateway = new Gateway(server, '/websocket');
Logger.preinit.info(`WebSocket server started.`);