const connectedUsers = [];

function addUser(id, user) {
	const users = $('#users');

	const element = $('<div class="user"></div>');
	const userInfo = $('<div class="user-info"></div>');
	const username = $('<a class="user-username"></a>');
	const buttonDisconnect = $('<button class="user-button-disconnect">Отключить</button>');

	username.text(`${user} (ID ${id})`);

	userInfo.append(username);

	element.append(userInfo);
	element.append(buttonDisconnect);
	buttonDisconnect.on('click', (event) => {
		websocket.send(JSON.stringify({
			admin: true,
			action: 'disconnect',
			user_id: id - 1
		}));
	});

	users.append(element);

	connectedUsers[id] = element;
}

function removeUser(id, user) {
	const element = connectedUsers[id];

	element.remove();

	delete connectedUsers[id];
}

function _log(html) {
	const chat = $('#chat');

	const element = $('<span class="message"></span>');

	element.html(html);

	chat.append(element);
	chat.append($('<br />'));

	chat.animate({scrollTop: $('#chat').prop("scrollHeight")}, 0);
}

const log = {
	local: function system(time, text) {
		_log(`<a class="message-time">[${time}] </a><a class="message-type message-local">[Client]: </a><a class="message-content">${text}</a>`);
	},

	system: function system(time, text) {
		_log(`<a class="message-time">[${time}] </a><a class="message-type message-system">[Gateway]: </a><a class="message-content">${text}</a>`);
	},
	error: function error(time, text) {
		_log(`<a class="message-time">[${time}] </a><a class="message-type message-error">[Error]: </a><a class="message-error">${text}</a>`);
	},

	incoming: function incoming(time, text) {
		_log(`<a class="message-time">[${time}] </a><a class="message-type message-incoming">[Incoming]: </a><a class="message-incoming">${text}</a>`);
	},
	outcoming: function outcoming(time, text) {
		_log(`<a class="message-time">[${time}] </a><a class="message-type message-outcoming">[Outcoming]: </a><a class="message-outcoming">${text}</a>`);
	}
};

function sendMessage(gateway) {
	if($('#input-content')[0].value.length < 1) return;

	const username = $('#input-username')[0].value;
	const content = $('#input-content')[0].value.replace(/(script)|(onclick)/g, 'invalid');

	$('#input-content')[0].value = '';
	
	if(gateway) {
		websocket.send(JSON.stringify({
			system: true,
			content: content
		}));
		//_log(`<a class="message-time">[${luxon.DateTime.local().toFormat('HH:mm:ss')}] </a><a class="message-type message-outcoming">[Outcoming]: </a><a class="message-type message-system">[Gateway]: </a><a class="message-outcoming">${content}</a>`);
	} else {
		websocket.send(JSON.stringify({
			username: username,
			content: content
		}));
		log.outcoming(luxon.DateTime.local().toFormat('HH:mm:ss'), `[${username || '<span style="color: #d84315;">Unknown</span>'}]: ${content}`);
	}
}

function connect(serverURL) {
	websocket = new WebSocket(serverURL);

	websocket.onopen = (event) => {
		log.system(luxon.DateTime.local().toFormat('HH:mm:ss'), 'Соединение с WebSocket сервером установлено');

		$('#input-server').prop('disabled', true);
		$('#input-server-conenct').prop('disabled', true);
		$('#input-server-disconenct').prop('disabled', false);

		$('#users').empty();
	};
	websocket.onclose = (event) => {
		log.system(luxon.DateTime.local().toFormat('HH:mm:ss'), 'Соединение с WebSocket сервером разорвано');

		$('#input-server').prop('disabled', false);
		$('#input-server-conenct').prop('disabled', false);
		$('#input-server-disconenct').prop('disabled', true);

		$('#users').empty();
	};
	websocket.onmessage = (event) => {
		try {
			console.log(event.data);
			const message = JSON.parse(event.data);
			if(message.type === 'gateway') {
				if(message.action === 'user_connect') {
					log.system(message.time, `${message.content}`);
					addUser(message.user.id, message.user.ip);
				}
				if(message.action === 'user_disconnect') {
					log.system(message.time, `${message.content}`);
					removeUser(message.user.id);
				}
				if(message.action === 'user_force_disconnect') {
					log.system(message.time, `${message.content}`);
					removeUser(message.user.id);
				}

				if(message.action === 'user_permissions_error') {
					log.system(message.time, `${message.content}`);
				}

				if(message.action === 'custom') {
					log.system(message.time, `${message.content}`);
				}
			} else if(message.type === 'user') {
				log.incoming(message.time, `[${message.username || '<span style="color: #d84315;">Unknown</span>'}]: ${message.content}`);
			}
		} catch(error) {
			log.error(null, error);
		}
	};
	websocket.onerror = (event) => {
		log.error(event.data);
	};
}

function disconnect() {
	$('#input-server').prop('disabled', false);
	$('#input-server-conenct').prop('disabled', false);
	$('#input-server-disconenct').prop('disabled', true);

	websocket.close();
}

$(document).ready(() => {
	$('#input-server')[0].value = 'ws://assasans.ml:2012/websocket';
	$('#input-server-disconenct').prop('disabled', true);

	$('#button-server-connect').on('click', (event) => {
		$('#chat').empty();

		const serverURL = $('#input-server')[0].value;

		log.local(luxon.DateTime.local().toFormat('HH:mm:ss'), `Подключение к серверу <b>${serverURL}</b>...`);

		connect(serverURL);
	});

	$('#button-server-disconnect').on('click', (event) => {		
		disconnect();
	});
	
	$('#button-send').on('click', (event) => {
		sendMessage(false);
	});
	$(document).on('keypress', (event) => {
		if(event.which === 13) {
			sendMessage(false);
		}
	});

	$('#button-send-gateway').on('click', (event) => {
		sendMessage(true);
	});

	$('#button-chat-clear').on('click', (event) => {
		$('#chat').empty();
	});
});