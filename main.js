// main.js
import MainMenuScene from './scenes/MainMenuScene.js';
import GameScene from './scenes/GameScene.js';
import GameOverScene from './scenes/GameOverScene.js';

const config = {
  type: Phaser.AUTO,
  width: 480,
  height: 640,
  backgroundColor: '#0d223a',
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [MainMenuScene, GameScene, GameOverScene]
};

const game = new Phaser.Game(config);
