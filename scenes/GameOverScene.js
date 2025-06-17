// scenes/GameOverScene.js
export default class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }
  init(data) {
    this.finalScore = data.score || 0;
  }
  create() {
    this.add.text(240, 240, 'GAME OVER', { font: '48px Arial', fill: '#ff2222' }).setOrigin(0.5);
    this.add.text(240, 340, 'Puntuación: ' + this.finalScore, { font: '24px Arial', fill: '#fff' }).setOrigin(0.5);
    this.add.text(240, 400, 'Presiona [ESPACIO] para reiniciar', { font: '18px Arial', fill: '#0ff' }).setOrigin(0.5);

    this.input.keyboard.on('keydown-SPACE', () => {
      this.scene.start('MainMenuScene');
    });
  }
}
