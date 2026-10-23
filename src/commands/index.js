import academic from './academic.js';
import dashboard from './dashboard.js';
import notice from './notice.js';
import portal from './portal.js';
import system from './system.js';

export const COMMANDS = [
  ...system,
  ...dashboard,
  ...academic,
  ...notice,
  ...portal
];
