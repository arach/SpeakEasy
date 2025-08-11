import * as path from 'path';
import { homedir } from 'os';

export const CONFIG_DIR = path.join(homedir(), '.config', 'speakeasy');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');


