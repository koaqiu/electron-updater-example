import { app } from "electron";
import * as path from "path";
import * as fs from "fs";

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';

export function getAppPath(isDevelopment: boolean): string {
	if (isDevelopment || isWin) {
		const appPath = app.getAppPath();
		const extName = path.extname(appPath);
		if (extName) {
			return path.join(path.dirname(appPath), '..');
		}
		return appPath;
	}
	return app.getPath('userData');
}

export function getConfigPath(isDevelopment: boolean): string {
	return path.join(getAppPath(isDevelopment), 'config.json');
}

export function assignObject(target: any, source: any) {
	//Object.assign(this.getDefaultConfig(), this._data);
	for (const key in source) {
		if (!source.hasOwnProperty(key))
			continue;
		const element = source[key];
		if (typeof element == 'object' && target.hasOwnProperty(key)) {
			if(typeof target[key] == 'object'){
				assignObject(target[key], source[key]);
			}else{
				target[key] = source[key];
			}
		} else {
			target[key] = source[key];
		}
	}
	return target;
}
