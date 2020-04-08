import * as WebSocket from 'ws';
import * as chalk from 'chalk';
import * as http from 'http';
import * as _ from 'lodash';

import Logger from './helper/logger';

export class Gateway {
	public server: WebSocket.Server;

	constructor(server: http.Server, path: string) {
		this.server = new WebSocket.Server({
			server: server,
			path: path
		});

		this.server.on('connection', (socket: WebSocket, request: http.IncomingMessage) => {
			Logger.websocket.trace(`Connection: ${chalk.blueBright(request.connection.remoteAddress)}`);
			this.broadcast(socket, JSON.stringify({
				system: true,
				action: `user_connect`,
				user: request.connection.remoteAddress
			}));

			socket.on('close', (code: number, reason: string) => {
				Logger.websocket.trace(`Connection ${chalk.blueBright(request.connection.remoteAddress)} closed with code ${chalk.blueBright(code)}`);
				this.broadcast(socket, JSON.stringify({
					system: true,
					action: `user_disconnect`,
					user: request.connection.remoteAddress
				}));
			});

			socket.on('message', (data: string) => {
				Logger.websocket.trace(`Connection ${chalk.blueBright(request.connection.remoteAddress)} send message: ${chalk.blueBright(data)}`);
				try {
					const message = JSON.parse(data);
					this.broadcast(socket, JSON.stringify({
						username: message.username,
						content: message.content
					}));
				} catch(error) {
					socket.send('Invalid JSON!');
				}
			});
		});
	}

	private broadcast(socket: WebSocket, content: string): void {
		this.server.clients.forEach((client: WebSocket) => {
			if(client !== socket) {
				client.send(content);
			}
		});
	}
}