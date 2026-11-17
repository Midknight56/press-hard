import '../app/src/fonts.css';
import '../app/src/form/theme.css';
import '../app/src/app.css';
import '../app/src/look.css';
import './site.css';
import { appConfig } from '../app/app.config.js';
import { prefersReducedMotion } from '../app/src/motion.js';
import { registerWorker } from '../app/src/offline.js';
import { startLoop } from './loop.js';

registerWorker('./sw.js', './');
document.title = appConfig.title;
const host = document.getElementById('loop');
const caption = document.getElementById('loop-caption');
if (host !== null && caption !== null) {
  void startLoop({ host, caption, reducedMotion: prefersReducedMotion() });
}
