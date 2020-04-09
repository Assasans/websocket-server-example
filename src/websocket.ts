import * as WebSocket from 'ws';
import * as chalk from 'chalk';
import * as http from 'http';
import * as _ from 'lodash';

import { DateTime } from 'luxon';

import Logger from './helper/logger';

export abstract class Message {
	public time: DateTime;
	public content: string;

	constructor(time: DateTime, content: string) {
		this.time = time;
		this.content = content;
	}
}

export type GatewayMessageType = 'custom' | 'user_connect' | 'user_disconnect';
export class GatewayMessage extends Message {
	public type: GatewayMessageType;

	constructor(time: DateTime, content: string, type: GatewayMessageType) {
		super(time, content);
		this.type = type;
	}

	public toJSON() {
		return {
			type: 'gateway',
			action: this.type,
			content: this.content,
			time: this.time.toFormat('HH:mm:ss')
		}
	}
}

export class GatewayCustomMessage extends GatewayMessage {
	constructor(time: DateTime, message: string) {
		super(time, message, 'custom');
	}
}

export class UserConnectMessage extends GatewayMessage {
	public user: User;
	public ip: string;

	constructor(time: DateTime, user: User, ip: string) {
		super(time, `Пациент <b>${ip}</b> попал в дурку`, 'user_connect');

		this.user = user;
		this.ip = ip;
	}

	public toJSON() {
		return {
			type: 'gateway',
			action: this.type,
			content: this.content,
			time: this.time.toFormat('HH:mm:ss'),
			user: this.user,
			ip: this.ip
		}
	}
}

export class UserDisconnectMessage extends GatewayMessage {
	public user: User;
	public ip: string;

	constructor(time: DateTime, user: User, ip: string) {
		super(time, `Пациент <b>${ip}</b> сбежал из дурки`, 'user_disconnect');

		this.user = user;
		this.ip = ip;
	}

	public toJSON() {
		return {
			type: 'gateway',
			action: this.type,
			content: this.content,
			time: this.time.toFormat('HH:mm:ss'),
			user: this.user,
			ip: this.ip,
		}
	}
}

export class UserMessage extends Message {
	public user: User;
	public username: string | null;

	constructor(time: DateTime, user: User, username: string | null, content: string) {
		super(time, content);
		this.user = user;
		this.username = username;
	}

	public toJSON() {
		return {
			type: 'user',
			username: this.username,
			content: this.content,
			time: this.time.toFormat('HH:mm:ss'),
			user: this.user
		}
	}
}

export class User {
	public id: number;
	public messages: Message[];
	
	public socket: WebSocket;

	constructor(id: number, messages: Message[], socket: WebSocket) {
		this.id = id;
		this.messages = messages;

		this.socket = socket;
	}

	public toJSON() {
		return {
			id: this.id
		};
	}

	public disconnect(): void {
		this.socket.close();
	}
}

export class Gateway {
	public server: WebSocket.Server;

	public users: User[];
	public messages: Message[];

	constructor(server: http.Server, path: string) {
		this.server = new WebSocket.Server({
			server: server,
			path: path
		});

		this.users = [];
		this.messages = [];

		this.server.on('connection', (socket: WebSocket, request: http.IncomingMessage) => {
			Logger.websocket.trace(`Connection: ${chalk.blueBright(request.connection.remoteAddress)}`);

			const userId: number = this.users.length + 1;
			const user: User = new User(
				userId,
				_.filter(this.messages, (message: Message) => {
					return message instanceof UserMessage && message.user.id === userId;
				}),
				socket
			);
			this.users.push(user);

			_.each(this.messages, (message: Message) => {
				socket.send(JSON.stringify(message));
			});

			const connectMessage: UserConnectMessage = new UserConnectMessage(
				DateTime.local(),
				user,
				request.connection.remoteAddress || 'Unknown'
			);
			this.broadcastAll(JSON.stringify(connectMessage));
			this.messages.push(connectMessage);

			socket.on('close', (code: number, reason: string) => {
				Logger.websocket.trace(`Connection ${chalk.blueBright(request.connection.remoteAddress)} closed with code ${chalk.blueBright(code)}`);

				const disconnectMessage: UserDisconnectMessage = new UserDisconnectMessage(
					DateTime.local(),
					user,
					request.connection.remoteAddress || 'Unknown'
				);
				this.broadcastAll(JSON.stringify(disconnectMessage));
				this.messages.push(disconnectMessage);
			});

			socket.on('message', (data: string) => {
				Logger.websocket.trace(`Connection ${chalk.blueBright(request.connection.remoteAddress)} send message: ${chalk.blueBright(data)}`);
				try {
					const message = JSON.parse(data);
					if(message.system) {
						const gatewayMessage: GatewayCustomMessage = new GatewayCustomMessage(
							DateTime.local(),
							message.content
						);
						this.broadcast(socket, JSON.stringify(gatewayMessage));
						this.messages.push(gatewayMessage);
					} else {
						const userMessage: UserMessage = new UserMessage(
							DateTime.local(),
							user,
							message.username || 'Unknown',
							message.content
						);
						this.broadcast(socket, JSON.stringify(userMessage));
						this.messages.push(userMessage);
					}
				} catch(error) {
					socket.send(JSON.stringify(new GatewayCustomMessage(
						DateTime.local(),
						'Invalid JSON!'
					)));
				}
			});
		});
	}

	private broadcastAll(content: string): void {
		this.server.clients.forEach((client: WebSocket) => {
			client.send(content);
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