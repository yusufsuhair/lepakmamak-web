import {appearance, tudungColour, type Appearance} from './appearance';
import './player-face.css';

export type FacePlayer = {name?: string; appearance?: Partial<Appearance> | null};

export function paintPlayerFace(root: HTMLElement, value?: Partial<Appearance> | null) {
  const look = appearance(value);
  root.style.setProperty('--face-skin', look.skin);
  root.style.setProperty('--face-hair', look.hair);
  root.style.setProperty('--face-shirt', look.shirt);
  root.style.setProperty('--face-tudung', tudungColour(look.tudung));
  root.dataset.gender = look.gender;
  root.dataset.hair = look.hairstyle;
  root.dataset.tudung = look.tudung;
}

export function createPlayerFace(player: FacePlayer, className = '') {
  const root = document.createElement('span');
  root.className = `player-face ${className}`.trim();
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = '<i class="player-face-tail"></i><i class="player-face-tudung"></i><i class="player-face-head"><b></b></i><i class="player-face-body"></i>';
  paintPlayerFace(root, player.appearance);
  return root;
}
