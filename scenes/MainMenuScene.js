// scenes/MainMenuScene.js
export default class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenuScene'); }
  create() {
    this.add.text(240, 200, '🚀 Naves Arcade 🚀', { font: '32px Arial', fill: '#fff' }).setOrigin(0.5);
    this.add.text(240, 300, 'Presiona [ESPACIO] para empezar', { font: '20px Arial', fill: '#ff0' }).setOrigin(0.5);

    this.input.keyboard.on('keydown-SPACE', () => {
      this.scene.start('GameScene', { mapIndex: 0, playerUpgrades: null, coins: 0 });
    });
  }
}
