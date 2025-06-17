const config = {
  type: Phaser.AUTO,
  width: 480,
  height: 1000, // o el alto que estés usando
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  backgroundColor: '#0d223a',
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [MainMenuScene, GameScene, GameOverScene]
};
const game = new Phaser.Game(config);