import Logger, { registerLoggers } from './helper/logger';
registerLoggers();

import * as chalk from 'chalk';
import * as http from 'http';

import { Gateway } from './websocket';

const server: http.Server = http.createServer((request: http.IncomingMessage, response: http.ServerResponse) => {
	Logger.web.trace(`[${chalk.green.bold(request.connection.remoteAddress)}]: ${chalk.yellow(request.method)} ${chalk.green(request.url)}`);
	response.end(`
	<!DOCTYPE html>
	<html>
		<head>
			<meta charset="utf-8" />
			<title>WebSocket Chat</title>
		</head>
		<body>
			<style>
			a {
				font-family: Arial;
			}

			.message {
				margin: 1em;
				word-wrap: break-word;
			}
			.message-type {
				font-weight: bold;
			}

			.message-content {
				color: #212121;
			}

			.message-system {
				color: #d32f2f;
			}
			.message-error {
				color: #e65100;
			}

			.message-incoming {
				color: #1565c0;
			}
			.message-outcoming {
				color: #6a1b9a;
			}
			</style>
			<script src="https://code.jquery.com/jquery-3.4.1.min.js"></script>
			<script>

			function _log(html) {
				const chat = $('#chat');

				const element = $('<span class="message"></span>');

				element.html(html);

				chat.append(element);
				chat.append($('<br />'));
			}

			const log = {
				system: function system(text) {
					_log(\`<a class="message-type message-system">[Gateway]: </a><a class="message-content">\${text}</a>\`);
				},
				error: function error(text) {
					_log(\`<a class="message-type message-error">[Error]: </a><a class="message-error">\${text}</a>\`);
				},

				incoming: function incoming(text) {
					_log(\`<a class="message-type message-incoming">[Incoming]: </a><a class="message-incoming">\${text}</a>\`);
				},
				outcoming: function outcoming(text) {
					_log(\`<a class="message-type message-outcoming">[Outcoming]: </a><a class="message-outcoming">\${text}</a>\`);
				}
			};

			function sendMessage() {
				const username = $('#input-username')[0].value;
				const content = $('#input-content')[0].value;

				$('#input-content')[0].value = '';

				log.outcoming(\`[\${username || '<span style="color: #d84315;">Unknown</span>'}]: \${content}\`);
				websocket.send(JSON.stringify({
					username: username,
					content: content
				}));
			}

			function connect(serverURL) {
				websocket = new WebSocket(serverURL);

				websocket.onopen = (event) => {
					log.system('Соединение с WebSocket сервером установлено');
				};
				websocket.onclose = (event) => {
					log.system('Соединение с WebSocket сервером разорвано');
				};
				websocket.onmessage = (event) => {
					try {
						console.log(event.data);
						const message = JSON.parse(event.data);
						if(message.system) {
							if(message.action === 'user_connect') {
								log.system(\`Пациент <b>\${message.user}</b> попал в дурку\`);
							}
							if(message.action === 'user_disconnect') {
								log.system(\`Пациент <b>\${message.user}</b> сбежал из дурки\`);
							}
						} else {
							log.incoming(\`[\${message.username || '<span style="color: #d84315;">Unknown</span>'}]: \${message.content}\`);
						}
					} catch(error) {
						log.error(error);
					}
				};
				websocket.onerror = (event) => {
					log.error(event.data);
				};
			}

			$(document).ready(() => {
				connect('ws://assasans.ml:2012/websocket');
				
				$('#button-send').on('click', (event) => {
					sendMessage();
				});
				$(document).on('keypress', (event) => {
					if(event.which === 13) {
						sendMessage();
					}
				});

				$('#button-chat-clear').on('click', (event) => {
					$('#chat').empty();
				});
			});
			</script>

			<h3>Дурка</h3>

			<input id="input-username" placeholder="Имя пользователя" /><br />
			<input id="input-content" placeholder="Сообщение" /><br />
			<button id="button-send">Отправить</button>
			<button id="button-chat-clear">Очистить чат</button><br />
			<br />

			<div id="chat"></div>
		</body>
	</html>
`);
});

server.listen(2012, '0.0.0.0');
    
Logger.preinit.info(`Starting WebSocket server...`);
const gateway: Gateway = new Gateway(server, '/websocket');
Logger.preinit.info(`WebSocket server started.`);