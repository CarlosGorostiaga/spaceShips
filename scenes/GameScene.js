// scenes/GameScene.js
export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  init(data) {
    this.mapIndex = data.mapIndex || 0;
    this.playerUpgrades = data.playerUpgrades || { attack: 1, defense: 1, maxHealth: 3 };
    this.coins = data.coins || 0;
  }

  preload() {
    // Cargar aquí todos los assets
    this.load.image('player', 'assets/playerShip1_blue.png');
    this.load.image('enemy', 'assets/enemyRed1.png');
    this.load.image('minion', 'assets/minion.png');
    this.load.image('bullet', 'assets/laserBlue01.png');
    this.load.image('boss1', 'assets/boss1.png');
    this.load.image('boss2', 'assets/boss2.png');
    this.load.image('boss3', 'assets/boss3.png');
    this.load.image('boss_bullet', 'assets/boss_bullet.png');
    this.load.spritesheet('explosion', 'assets/explosion.png', { frameWidth: 32, frameHeight: 32 });
    this.load.image('laser', 'assets/laser.png');
  }

  create() {
    // Variables de escena
    this.score = 0;
    this.playerLives = this.playerUpgrades.maxHealth;
    this.invulnerable = false;
    this.lastEnemySpawn = 0;
    this.boss = null;
    this.bossHealthBar = null;
    this.bossPhase = 1;
    this.bossDestroyed = false;
    this.bossMoveDir = 1;
    this.lastBossShot = 0;
    this.bossSpeech = null;
    this.bossTalkTimer = 0;
    this.level = this.mapIndex+1;

    this.cursors = this.input.keyboard.createCursorKeys();
    this.player = this.physics.add.sprite(240, 570, 'player');
    this.player.setCollideWorldBounds(true);

    this.bullets = this.physics.add.group();
    this.enemies = this.physics.add.group();
    this.minions = this.physics.add.group();
    this.bossBullets = this.physics.add.group();
    this.explosions = this.add.group();

    this.anims.create({
      key: 'explode',
      frames: this.anims.generateFrameNumbers('explosion', { start: 0, end: 7 }),
      frameRate: 14,
      repeat: 0,
      hideOnComplete: true
    });

    this.scoreText = this.add.text(10, 10, 'Score: 0', { font: '20px Arial', fill: '#fff' });
    this.livesText = this.add.text(370, 10, 'Vidas: ' + this.playerLives, { font: '20px Arial', fill: '#fff' });

    this.bossHealthBar = this.add.rectangle(240, 30, 300, 16, 0x00ff44).setOrigin(0.5, 0.5).setVisible(false);
    this.bossHealthText = this.add.text(240, 10, '', { font: '16px Arial', fill: '#fff' }).setOrigin(0.5, 0).setVisible(false);
    this.bossSpeech = this.add.text(240, 65, '', { font: 'bold 18px Arial', fill: '#fff', backgroundColor: '#222', padding: { x: 12, y: 4 } }).setOrigin(0.5, 0.5).setVisible(false);

    // Colisiones
    this.physics.add.overlap(this.bullets, this.enemies, this.bulletHitsEnemy, null, this);
    this.physics.add.overlap(this.bullets, this.minions, this.bulletHitsMinion, null, this);
    this.physics.add.overlap(this.bossBullets, this.player, this.bossBulletHitsPlayer, null, this);
    this.physics.add.overlap(this.enemies, this.player, this.enemyHitsPlayer, null, this);
    this.physics.add.overlap(this.minions, this.player, this.enemyHitsPlayer, null, this);
  }

  update(time, delta) {
    // --- Player movement ---
    if (this.cursors.left.isDown) this.player.setVelocityX(-300);
    else if (this.cursors.right.isDown) this.player.setVelocityX(300);
    else this.player.setVelocityX(0);

    // --- Shooting ---
    if ((this.cursors.space.isDown || this.input.activePointer.isDown) && (!this.lastFired || time > this.lastFired + 250)) {
      let bullet = this.bullets.create(this.player.x, this.player.y-30, 'bullet');
      bullet.setVelocityY(-500);
      bullet.setCollideWorldBounds(false);
      this.lastFired = time;
    }

    // --- Spawn Enemies ---
    if (!this.boss && (!this.lastEnemySpawn || time > this.lastEnemySpawn + 1200) && this.score < 100) {
      let x = Phaser.Math.Between(30, 450);
      let enemy = this.enemies.create(x, -20, 'enemy');
      enemy.setVelocityY(90);
      this.lastEnemySpawn = time;
    }

    // --- Clean Up ---
    this.enemies.children.iterate(enemy => { if (enemy && enemy.y > 700) enemy.destroy(); });
    this.bullets.children.iterate(bullet => { if (bullet && bullet.y < -40) bullet.destroy(); });
    this.bossBullets.children.iterate(bullet => { if (bullet && (bullet.y > 700 || bullet.x < -40 || bullet.x > 520)) bullet.destroy(); });

    // --- Boss Logic ---
    if (!this.boss && this.score >= 100 && !this.bossDestroyed) this.spawnBoss();

    if (this.boss) {
      this.bossMovementAndAttacks(time);

      if (this.boss.health <= 0 && !this.bossDestroyed) {
        this.boss.setTexture('boss3');
        this.bossHealthBar.setVisible(false);
        this.bossHealthText.setVisible(false);
        this.bossDestroyed = true;
        this.bossTalk("¡Noooooo!");
        this.createExplosion(this.boss.x, this.boss.y);
        this.score += 150;
        this.scoreText.setText('Score: ' + this.score + ' (Boss derrotado!)');
        setTimeout(() => { if (this.boss) this.boss.destroy(); this.scene.start('GameOverScene', { score: this.score }); }, 1600);
      }
    }

    // --- Boss Speech Bubble Timeout ---
    if (this.bossSpeech.visible && time > this.bossTalkTimer + 2200) this.bossSpeech.setVisible(false);
  }

  // ------------------- LOGICA DE BOSS Y ENEMIGOS -------------------
  spawnBoss() {
    this.boss = this.physics.add.sprite(240, 120, 'boss1');
    this.boss.setImmovable(true);
    this.boss.health = 500;
    this.bossPhase = 1;
    this.bossDestroyed = false;
    this.bossHealthBar.setVisible(true);
    this.bossHealthText.setVisible(true);
    this.boss.setScale(1.5);
    this.bossMoveDir = 1;
    this.bossTalk("¡Prepárate para morir!");
  }

  bossMovementAndAttacks(time) {
    if (this.boss.x <= 60) this.bossMoveDir = 1;
    if (this.boss.x >= 420) this.bossMoveDir = -1;
    let moveSpeed = this.bossPhase === 1 ? 2 : 4;
    this.boss.x += moveSpeed * this.bossMoveDir;

    if (this.bossPhase === 1) {
      if (time > this.lastBossShot + 1500) {
        this.shootBossBullet(this.boss.x, this.boss.y + this.boss.height/2, 0, 300, 1);
        this.lastBossShot = time;
      }
    } else if (this.bossPhase === 2 && !this.bossDestroyed) {
      if (time > this.lastBossShot + 1000) {
        for (let i = -2; i <= 2; i++) {
          let angle = Phaser.Math.DegToRad(i * 20);
          let vx = Math.sin(angle) * 200;
          let vy = Math.cos(angle) * 320;
          this.shootBossBullet(this.boss.x, this.boss.y + this.boss.height/2, vx, vy, 2);
        }
        this.lastBossShot = time;
      }
      if (Math.random() < 0.01) this.bossMoveDir *= -1;
    }
    // Fase 2 trigger
    if (this.boss.health <= 250 && this.bossPhase === 1) {
      this.boss.setTexture('boss2');
      this.bossTalk("¡Ahora verás mi verdadero poder!");
      this.bossPhase = 2;
    }
    // Barra vida
    this.updateBossHealthBar();
  }

  shootBossBullet(x, y, velX, velY, power = 1) {
    let bossBullet = this.bossBullets.create(x, y+40, 'boss_bullet');
    bossBullet.setVelocity(velX, velY);
    bossBullet.setCollideWorldBounds(false);
    bossBullet.power = power;
  }

  // ------------------- COLISIONES Y DAÑOS -------------------
  bulletHitsEnemy(bullet, enemy) {
    bullet.destroy();
    this.createExplosion(enemy.x, enemy.y);
    enemy.destroy();
    this.score += 10;
    this.scoreText.setText('Score: ' + this.score);
  }
  bulletHitsMinion(bullet, minion) {
    bullet.destroy();
    this.createExplosion(minion.x, minion.y);
    minion.destroy();
    this.score += 5;
    this.scoreText.setText('Score: ' + this.score);
  }
  bossBulletHitsPlayer(player, bossBullet) {
    if (this.invulnerable) return;
    bossBullet.destroy();
    this.playerHit();
  }
  enemyHitsPlayer(player, enemy) {
    if (this.invulnerable) return;
    this.createExplosion(player.x, player.y);
    enemy.destroy();
    this.playerHit();
  }
  playerHit() {
    this.playerLives--;
    this.livesText.setText('Vidas: ' + this.playerLives);
    this.player.setTint(0xff4444);
    this.invulnerable = true;
    if (this.playerLives <= 0) {
      this.player.setVisible(false);
      this.bossTalk("¡Te lo advertí, terrícola!");
      setTimeout(() => this.scene.start('GameOverScene', { score: this.score }), 1500);
    } else {
      setTimeout(() => {
        this.player.clearTint();
        this.invulnerable = false;
      }, 1200);
    }
  }
  updateBossHealthBar() {
    const percent = Math.max(this.boss.health / 500, 0);
    this.bossHealthBar.width = 300 * percent;
    this.bossHealthBar.setFillStyle(percent > 0.5 ? 0x00ff44 : percent > 0.2 ? 0xffff44 : 0xff4444);
    this.bossHealthText.setText('Boss: ' + Math.max(this.boss.health, 0) + ' / 500' + (this.bossPhase > 1 ? " ⚡" : ""));
  }
  bossTalk(text) {
    this.bossSpeech.setText(text).setVisible(true);
    this.bossTalkTimer = Date.now();
  }
  createExplosion(x, y, scale = 1) {
    let boom = this.add.sprite(x, y, 'explosion');
    boom.setScale(scale);
    boom.play('explode');
  }
}
