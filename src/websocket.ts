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

export type GatewayMessageType = 'custom' |
	'user_connect' | 'user_disconnect' | 'user_force_disconnect' |
	'user_permissions_error';
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

	constructor(time: DateTime, user: User) {
		super(time, `Пациент <b>${user.ip}</b> (ID ${user.id}) попал в дурку`, 'user_connect');

		this.user = user;
	}

	public toJSON() {
		return {
			type: 'gateway',
			action: this.type,
			content: this.content,
			time: this.time.toFormat('HH:mm:ss'),
			user: this.user
		}
	}
}

export class UserDisconnectMessage extends GatewayMessage {
	public user: User;

	constructor(time: DateTime, user: User) {
		super(time, `Пациент <b>${user.ip}</b> (ID ${user.id}) сбежал из дурки`, 'user_disconnect');

		this.user = user;
	}

	public toJSON() {
		return {
			type: 'gateway',
			action: this.type,
			content: this.content,
			time: this.time.toFormat('HH:mm:ss'),
			user: this.user
		}
	}
}
export class UserForceDisconnectMessage extends GatewayMessage {
	public user: User;

	constructor(time: DateTime, user: User) {
		super(time, `Пациент <b>${user.ip}</b> (ID ${user.id}) отключён от сервера`, 'user_force_disconnect');

		this.user = user;
	}

	public toJSON() {
		return {
			type: 'gateway',
			action: this.type,
			content: this.content,
			time: this.time.toFormat('HH:mm:ss'),
			user: this.user
		}
	}
}
export class UserPermissionsErrorMessage extends GatewayMessage {
	public user: User;

	constructor(time: DateTime, user: User) {
		super(time, `У пациента <b>${user.ip}</b> (ID ${user.id}) недостаточно прав!`, 'user_permissions_error');

		this.user = user;
	}

	public toJSON() {
		return {
			type: 'gateway',
			action: this.type,
			content: this.content,
			time: this.time.toFormat('HH:mm:ss'),
			user: this.user
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

export class UserPermissions {
	public sendGateway: boolean;
	public disconnectUsers: boolean;

	constructor(sendGateway: boolean, disconnectUsers: boolean) {
		this.sendGateway = sendGateway;
		this.disconnectUsers = disconnectUsers;
	}

	public static default(): UserPermissions {
		return new UserPermissions(
			false,
			false
		);
	}

	public toJSON() {
		return {
			send_gateway: this.sendGateway,
			disconnect_users: this.disconnectUsers
		};
	}
}

export class User {
	public id: number;
	public ip: string;
	public permissions: UserPermissions;

	public messages: Message[];
	
	public socket: WebSocket;

	constructor(id: number, ip: string, permissions: UserPermissions, messages: Message[], socket: WebSocket) {
		this.id = id;
		this.ip = ip;
		this.permissions = permissions;

		this.messages = messages;

		this.socket = socket;
	}

	public toJSON() {
		return {
			id: this.id,
			ip: this.ip,
			permissions: this.permissions
		};
	}

	public disconnect(): void {
		this.socket.close();
	}
}

export type CommandArgs = string[];/*{
	[key: string]: string | number | boolean;
};*/
export abstract class Command {
	public name: string;
	public description: string;
	
	constructor(name: string, description: string) {
		this.name = name;
		this.description = description;
	}

	public async hasPermission(registry: CommandRegistry, user: User): Promise<boolean> {
		return true;
	}
	public abstract async run(registry: CommandRegistry, user: User, args: CommandArgs): Promise<boolean>;
}

export class AdminAddCommand extends Command {
	constructor() {
		super(
			'admin-add',
			'Добавляет права администратора пользователю'
		);
	}

	public async run(registry: CommandRegistry, user: User, args: CommandArgs): Promise<boolean> {
		const targetUser: User | null = registry.gateway.users[Number.parseInt(args[0]) - 1] || null;
		if(targetUser) {
			targetUser.permissions = new UserPermissions(true, true);

			const gatewayMessage: GatewayCustomMessage = new GatewayCustomMessage(
				DateTime.local(),
				`Права администратора были выданы пациенту <b>${user.id}</b>`
			);
			registry.gateway.broadcastAll(JSON.stringify(gatewayMessage));
			registry.gateway.messages.push(gatewayMessage);
		} else {
			const gatewayMessage: GatewayCustomMessage = new GatewayCustomMessage(
				DateTime.local(),
				`Пациент <b>${user.id}</b> не найден.`
			);
			user.socket.send(JSON.stringify(gatewayMessage));
			registry.gateway.messages.push(gatewayMessage);
		}
		return true;
	}
}

export class HelpCommand extends Command {
	constructor() {
		super(
			'help',
			'Показать список доступных команд'
		);
	}

	public async run(registry: CommandRegistry, user: User, args: CommandArgs): Promise<boolean> {
		user.socket.send(JSON.stringify(new GatewayCustomMessage(
			DateTime.local(),
			`Доступные команды: <ul>${registry.commands.map((command: Command) => {
				return `<li>${registry.prefix}${command.name} - ${command.description}</li>`;
			}).join('\n')}</ul>`
		)));
		return true;
	}
}

export class UnknownCommand extends Command {
	constructor() {
		super(
			'unknown',
			'Неизвестная команда'
		);
	}

	public async run(registry: CommandRegistry, user: User, args: CommandArgs): Promise<boolean> {
		user.socket.send(JSON.stringify(new GatewayCustomMessage(
			DateTime.local(),
			`Неизвестная команда. Напишите <u>${registry.prefix}help</u> для отображения списка команд`
		)));
		return true;
	}
}

export type CommandConstructor = {
	new (): Command;
};
export class CommandRegistry {
	public gateway: Gateway;

	public prefix: string;
	public commands: Command[];

	public unknownCommand: Command;;

	constructor(gateway: Gateway, prefix: string) {
		this.gateway = gateway;

		this.prefix = prefix;
		this.commands = [];
	}

	public setUnknownCommand(CommandClass: CommandConstructor): CommandRegistry {
		this.unknownCommand = new CommandClass();
		return this;
	}

	public registerCommand(CommandClass: CommandConstructor): CommandRegistry {
		const instance: Command = new CommandClass();

		if(this.commands.find((command: Command) => {
			return command.name === instance.name;
		}) === undefined) {
			this.commands.push(instance);
		}
		return this;
	}

	public parseCommand(content: string): Command | false | null {
		if(content.startsWith(this.prefix)) {
			const rawArgs: string[] = content
				.slice(this.prefix.length)
				.split(' ');
			const commandName: string = rawArgs[0];

			const command: Command | null = this.commands.find((command: Command) => {
				return command.name === commandName;
			}) || null;
			if(!command) return false;
			return command;
		}
		return null;
	}

	public parseArgs(content: string): string[] {
		const rawArgs: string[] = content
			.slice(this.prefix.length)
			.split(' ')
			.slice(1);
		
		return rawArgs;
	}

	public async handleMessage(user: User, content: string): Promise<boolean> {
		const command: Command | false | null = this.parseCommand(content);
		if(command === null) return false;
		if(command === false) {
			if(!this.unknownCommand) return false;
			return this.unknownCommand.run(this, user, this.parseArgs(content));
		}
		if(!await command.hasPermission(this, user)) return false;
		return await command.run(this, user, this.parseArgs(content));
	}
}

export class Gateway {
	public server: WebSocket.Server;

	public commandRegistry: CommandRegistry;

	public users: User[];
	public messages: Message[];

	constructor(server: http.Server, path: string) {
		this.server = new WebSocket.Server({
			server: server,
			path: path
		});

		this.commandRegistry = new CommandRegistry(this, '/');
		this.commandRegistry
			.setUnknownCommand(UnknownCommand)
			.registerCommand(HelpCommand)
			.registerCommand(AdminAddCommand);

		this.users = [];
		this.messages = [];

		this.server.on('connection', (socket: WebSocket, request: http.IncomingMessage) => {
			Logger.websocket.trace(`Connection: ${chalk.blueBright(request.connection.remoteAddress)}`);

			const userId: number = this.users.length + 1;
			const user: User = new User(
				userId,
				request.connection.remoteAddress || 'Unknown',
				UserPermissions.default(),
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
				user
			);
			this.broadcastAll(JSON.stringify(connectMessage));
			this.messages.push(connectMessage);

			socket.on('close', (code: number, reason: string) => {
				Logger.websocket.trace(`Connection ${chalk.blueBright(request.connection.remoteAddress)} closed with code ${chalk.blueBright(code)}`);

				const disconnectMessage: UserDisconnectMessage = new UserDisconnectMessage(
					DateTime.local(),
					user
				);
				this.broadcastAll(JSON.stringify(disconnectMessage));
				this.messages.push(disconnectMessage);
			});

			socket.on('message', (data: string) => {
				Logger.websocket.trace(`Connection ${chalk.blueBright(request.connection.remoteAddress)} send message: ${chalk.blueBright(data)}`);
				try {
					const message = JSON.parse(data);
					if(message.admin) {
						if(message.action === 'disconnect') {
							if(!user.permissions.disconnectUsers) {
								const gatewayMessage: UserPermissionsErrorMessage = new UserPermissionsErrorMessage(
									DateTime.local(),
									user
								);
								socket.send(JSON.stringify(gatewayMessage));
								this.messages.push(gatewayMessage);
								return;
							}

							const targetUser: User | null = this.users[message.user_id] || null;
							if(targetUser) {
								targetUser.disconnect();
								const gatewayMessage: UserForceDisconnectMessage = new UserForceDisconnectMessage(
									DateTime.local(),
									user
								);
								this.broadcastAll(JSON.stringify(gatewayMessage));
								this.messages.push(gatewayMessage);
							} else {
								const gatewayMessage: GatewayCustomMessage = new GatewayCustomMessage(
									DateTime.local(),
									`Пациент <b>${user.id}</b> не найден.`
								);
								socket.send(JSON.stringify(gatewayMessage));
								this.messages.push(gatewayMessage);
							}
						}
						return;
					}
					if(message.system) {
						if(!user.permissions.sendGateway) {
							const gatewayMessage: UserPermissionsErrorMessage = new UserPermissionsErrorMessage(
								DateTime.local(),
								user
							);
							socket.send(JSON.stringify(gatewayMessage));
							this.messages.push(gatewayMessage);
							return;
						}

						const gatewayMessage: GatewayCustomMessage = new GatewayCustomMessage(
							DateTime.local(),
							message.content
						);
						this.broadcastAll(JSON.stringify(gatewayMessage));
						this.messages.push(gatewayMessage);
					} else {
						const content: string = message.content;

						if(this.commandRegistry.handleMessage(user, content)) {
							//return;
						}

						const userMessage: UserMessage = new UserMessage(
							DateTime.local(),
							user,
							message.username || 'Unknown',
							content
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

	public broadcastAll(content: string): void {
		this.server.clients.forEach((client: WebSocket) => {
			client.send(content);
		});
	}

	public broadcast(socket: WebSocket, content: string): void {
		this.server.clients.forEach((client: WebSocket) => {
			if(client !== socket) {
				client.send(content);
			}
		});
	}
}