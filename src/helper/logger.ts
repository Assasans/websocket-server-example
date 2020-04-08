import * as log4js from 'log4js';
import * as chalk from 'chalk';

const Logger = {
	preinit: log4js.getLogger('PreInit'),
	main: log4js.getLogger('Main'),
	
	websocket: log4js.getLogger('WebSocket'),
	web: log4js.getLogger('Web'),
};

export function registerLoggers(): void {
	log4js.configure({
		appenders: {
			console: {
				type: 'console',
				layout: {
					type: 'pattern',
					pattern: `%[[%d{hh:mm:ss}] [%p/${chalk.bold('%c')}]%]: %m`
				}
			},
			file: {
				type: 'file',
				filename: 'logs/server.log',
				pattern: 'yyyy-MM-dd_hh',
				maxLogSize: 1024 * 1024 * 1024 * 8,
				backups: 2048,
				compress: true,
				keepFileExt: true,
				layout: {
					type: 'pattern',
					pattern: `%[[%d{hh:mm:ss}] [%p/${chalk.bold('%c')}]%]: %m`
				}
			}
		},
		categories: {
			default: {
				appenders: [
					'console',
					'file'
				],
				level: 'all'
			}
		}
	});
}

export default Logger;