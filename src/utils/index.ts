import { app } from "electron";
import * as path from "path";
import * as fs from "fs";

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';

export function getAppPath(isDevelopment: boolean):string { 
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

export function getConfigPath(isDevelopment: boolean): string{
	return path.join(getAppPath(isDevelopment), 'config.json');
}
