import * as Fs from 'fs';

interface IUpdateConfig {
    autoCheck: boolean,
    autoDownload: boolean,
    autoInstall: boolean
}
interface IConfig {
    version?: number,
    fullScreen: boolean,
    alwaysOnTop: boolean,
    url: string,
    update: IUpdateConfig,
    startOnLogin: boolean
}
const CONFIG_VERSION = 2;
export default class Config {
    private _data: IConfig;
    private _configPath: Fs.PathLike;

    public get FullScreen(): boolean {
        return this._data.fullScreen;
    }
    public get AlwaysOnTop(): boolean {
        return this._data.alwaysOnTop;
    }

    public get Url(): string {
        return this._data.url;
    }
    public get Update(): IUpdateConfig {
        return this._data.update;
    }
    public get StartOnLogin(): boolean {
        return this._data.startOnLogin;
    }

    public get Path(): string {
        return this._configPath.toString();
    }
    constructor() {
        this._data = this.getDefaultConfig();
    }
    protected getDefaultConfig(): IConfig {
        return {
            version: CONFIG_VERSION,
            fullScreen: false,
            alwaysOnTop: false,
            url: '',
            update: {
                autoCheck: true,
                autoDownload: true,
                autoInstall: false
            },
            startOnLogin: true
        }
    }
    static load(url: Fs.PathLike): Config {
        const config = new Config();
        try {
            config._configPath = url;
            config._data = <IConfig>JSON.parse(Fs.readFileSync(url).toString());
            config.checkVersion();
        } catch (erro) {
            return null;
        }
        return config;
    }
    protected checkVersion() {
        if (this._data.version) {
            if (CONFIG_VERSION <= this._data.version) return;
        }
        this._data = Object.assign(this.getDefaultConfig(), this._data);
        this.save(this._configPath);
    }
    public save(url: Fs.PathLike): Config {
        try {
            this._configPath = url;
            Fs.writeFileSync(url, JSON.stringify(this._data));
        } catch (erro) {
        }
        return this;
    }
}