export default class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  init(data) {
    this.mapIndex = data.mapIndex || 0;
    this.playerUpgrades = data.playerUpgrades || { attack: 1, defense: 1, maxHealth: 3 };
    this.coins = data.coins || 0;
  }

  preload() {
    this.load.image('player', 'assets/playerShip1_blue.png');
    this.load.image('minion', 'assets/minion.png');
    this.load.image('bullet', 'assets/laserBlue01.png');
    this.load.image('boss1', 'assets/boss1.png');
    this.load.image('boss2', 'assets/boss2.png');
    this.load.image('boss3', 'assets/boss3.png');
    this.load.image('boss_bullet', 'assets/boss_bullet.png');
    this.load.image('enemy_bullet', 'assets/laserRed05.png');
    this.load.image('pill', 'assets/pill_red.png');
    this.load.spritesheet('explosion', 'assets/explosion.png', { frameWidth: 64, frameHeight: 64 });
    this.load.image('background', 'assets/blue.png');
    for (const color of ['Red','Green','Black']) {
      for (let i = 1; i <= 5; i++) {
        this.load.image(`enemy${color}${i}`, `assets/enemy${color}${i}.png`);
      }
    }
  }

  create() {
    // --- Fondo desplazable ---
    this.bg = this.add.tileSprite(240, 500, 480, 1000, 'background');

    this.score = 0;
    this.playerLives = this.playerUpgrades.maxHealth;
    this.invulnerable = false;
    this.lastEnemySpawn = 0;
    this.boss = null;
    this.bossPhase = 1;
    this.bossDestroyed = false;
    this.lastBossShot = 0;
    this.lastBossTriple = 0;
    this.pillStartDropped = false;
    this.pillsPhase2Dropped = 0;

    // --- Player ---
    this.cursors = this.input.keyboard.createCursorKeys();
    this.player = this.physics.add.sprite(240, 930, 'player').setCollideWorldBounds(true);

    // --- Groups ---
    this.bullets     = this.physics.add.group();
    this.enemies     = this.physics.add.group();
    this.minions     = this.physics.add.group();
    this.bossBullets = this.physics.add.group();
    this.enemyBullets = this.physics.add.group();
    this.lifePills = this.physics.add.group();

    // --- UI ---
    this.scoreText = this.add.text(10,10,'Score: 0',{ font:'20px Arial', fill:'#fff' });
    this.livesText = this.add.text(370,10,'Vidas: '+this.playerLives,{ font:'20px Arial', fill:'#fff' });

    this.bossHealthBar = this.add.rectangle(240, 30, 300, 16, 0x00ff44)
      .setOrigin(0.5,0.5).setVisible(false);
    this.bossHealthText = this.add.text(240, 10, '', { font: '16px Arial', fill: '#fff' })
      .setOrigin(0.5,0).setVisible(false);

    this.bossSpeech = this.add.text(240, 65, '', {
      font: 'bold 18px Arial', fill: '#fff',
      backgroundColor: '#222', padding: { x: 12, y: 4 }
    }).setOrigin(0.5, 0.5).setVisible(false);

    // --- Explosión animada ---
    this.anims.create({
      key: 'explode',
      frames: this.anims.generateFrameNumbers('explosion',{ start:0, end:7 }),
      frameRate: 18, repeat:0, hideOnComplete:true
    });

    // --- Overlaps ---
    this.physics.add.overlap(this.bullets, this.enemies, this.bulletHitsEnemy, null, this);
    this.physics.add.overlap(this.bullets, this.minions, this.bulletHitsMinion, null, this);
    this.physics.add.overlap(this.bossBullets, this.player, this.bossBulletHitsPlayer, null, this);
    this.physics.add.overlap(this.enemyBullets, this.player, this.enemyBulletHitsPlayer, null, this);
    this.physics.add.overlap(this.player, this.lifePills, this.playerGetsLife, null, this);
    this.physics.add.overlap(this.enemies, this.player, this.enemyHitsPlayer, null, this);
    this.physics.add.overlap(this.minions, this.player, this.enemyHitsPlayer, null, this);

    // Boss group para hitbox
    this.bossGroup = this.physics.add.group();
  }

  update(time) {
    this.bg.tilePositionY -= 1.5;

    // --- Movimiento player ---
    if (this.cursors.left.isDown)  this.player.setVelocityX(-300);
    else if (this.cursors.right.isDown) this.player.setVelocityX(300);
    else this.player.setVelocityX(0);

    // --- Disparo jugador ---
    if ((this.cursors.space.isDown || this.input.activePointer.isDown) 
         && (!this.lastFired || time > this.lastFired + 250)) {
      let b = this.bullets.create(this.player.x, this.player.y-30,'bullet');
      b.setVelocityY(-500).setCollideWorldBounds(false);
      this.lastFired = time;
    }

    // --- Spawn enemigos ---
    if (!this.boss && (!this.lastEnemySpawn || time > this.lastEnemySpawn + 1200) && this.score < 100) {
      let x = Phaser.Math.Between(30,450);
      const colors = ['Red','Green','Black'];
      const color = colors[Phaser.Math.Between(0, colors.length-1)];
      const num = Phaser.Math.Between(1,5);
      const skin = `enemy${color}${num}`;
      let e = this.enemies.create(x,-20,skin);
      e.setVelocityY(90);
      this.lastEnemySpawn = time;
    }

    // --- Limpiar fuera de pantalla ---
    this.enemies.children.iterate(e => { if(e && e.y>1050) e.destroy(); });
    this.bullets.children.iterate(b => { if(b && b.y< -40) b.destroy(); });
    this.bossBullets.children.iterate(b => { if(b && b.y>1050) b.destroy(); });
    this.enemyBullets.children.iterate(b => { if(b && b.y>1050) b.destroy(); });
    this.lifePills.children.iterate(pill => { if(pill && pill.y>1050) pill.destroy(); });

    // --- Enemigos disparan ---
    this.enemies.children.iterate(enemy => {
      if (!enemy) return;
      if (!enemy.lastShot) enemy.lastShot = 0;
      if (this.time.now > enemy.lastShot + Phaser.Math.Between(3500, 6500)) {
        this.shootEnemyBullet(enemy.x, enemy.y+10);
        enemy.lastShot = this.time.now;
      }
    });

    // --- Lógica de boss ---
    if (!this.boss && this.score>=100 && !this.bossDestroyed) {
      this.spawnBoss();
    }
    if (this.boss) {
      this.bossMovementAndAttacks(time);
      this.updateBossHealthBar();
      if (this.boss.health<=0 && !this.bossDestroyed) {
        this.bossDestroyed=true;
        this.boss.setTexture('boss3');
        this.bossHealthBar.setVisible(false);
        this.bossHealthText.setVisible(false);
        this.bossTalk("¡Noooooo!");
        this.createExplosion(this.boss.x,this.boss.y,2);
        this.time.delayedCall(1600, ()=> this.scene.start('GameOverScene',{ score:this.score }));
      }
    }

    // Diálogo del boss: oculta tras 1.8s
    if (this.bossSpeech.visible && this.time.now > this.bossTalkTimer + 1800) {
      this.bossSpeech.setVisible(false);
    }
  }

  spawnBoss() {
    this.boss = this.physics.add.sprite(240,150,'boss1')
      .setImmovable(true).setScale(0.25);
    this.boss.health = 750;
    this.bossPhase = 1;
    this.bossDestroyed = false;
    this.lastBossShot = 0;
    this.lastBossTriple = 0;
    this.boss.dir = 1;
    this.boss.upDownDir = 1;
    this.bossHealthBar.setVisible(true);
    this.bossHealthText.setVisible(true);

    this.pillStartDropped = false;
    this.pillsPhase2Dropped = 0;

    this.boss.body.setSize(this.boss.displayWidth, this.boss.displayHeight * 0.60);

    this.bossGroup.clear(true, true);
    this.bossGroup.add(this.boss);
    this.physics.add.overlap(this.bullets, this.bossGroup, this.bulletHitsBoss, null, this);

    this.bossTalk("¡Prepárate para morir!");
    // Dropea una pildora al aparecer el boss
    if (!this.pillStartDropped) {
      this.time.delayedCall(400, () => {
        this.dropLifePill(this.boss.x, this.boss.y + this.boss.displayHeight/2 + 10);
      });
      this.pillStartDropped = true;
    }
  }

  bossMovementAndAttacks(time) {
    // --- Movimiento lateral y vertical ---
    if (!this.boss.tweening) {
      this.boss.tweening = true;
      let destinoX = this.boss.x < 240 ? 430 : 50;
      this.tweens.add({
        targets: this.boss,
        x: destinoX,
        duration: 1100,
        ease: 'Sine.easeInOut',
        onComplete: () => { this.boss.tweening = false; }
      });
    }
    if (!this.boss.vtweening) {
      this.boss.vtweening = true;
      let minY = 120, maxY = 280;
      let destinoY = Phaser.Math.Between(minY, maxY);
      this.tweens.add({
        targets: this.boss,
        y: destinoY,
        duration: Phaser.Math.Between(1700, 2600),
        ease: 'Sine.easeInOut',
        onComplete: () => { this.boss.vtweening = false; }
      });
    }

    if (this.bossPhase === 1) {
      if (this.time.now > this.lastBossShot + 1450) {
        this.shootBossBullet(this.boss.x, this.boss.y + this.boss.displayHeight/2, 0, 150, 1);
        this.lastBossShot = this.time.now;
      }
    } else if (this.bossPhase === 2 && !this.bossDestroyed) {
      // --- DISPARO TRIPLE cada 5s ---
      if (!this.lastBossTriple || this.time.now - this.lastBossTriple > 5000) {
        this.bossTalk("¡Triple disparo!");
        this.time.delayedCall(400, () => {
          for (let i = -1; i <= 1; i++) {
            let angle = Phaser.Math.DegToRad(i * 18);
            let vx = Math.sin(angle) * 125;
            let vy = Math.cos(angle) * 220;
            this.shootBossBullet(this.boss.x, this.boss.y + this.boss.displayHeight/2, vx, vy, 1);
          }
        });
        this.lastBossTriple = this.time.now;
        this.lastBossShot = this.time.now;
      } else if (this.time.now > this.lastBossShot + 1200) {
        this.shootBossBullet(this.boss.x, this.boss.y + this.boss.displayHeight/2, 0, 170, 1);
        this.lastBossShot = this.time.now;
      }
      // Disparo especial raro (cada ~6,5s)
      if (!this.boss.lastSpecial || this.time.now > this.boss.lastSpecial + 6500) {
        this.bossTalk("¡Láser especial!");
        this.time.delayedCall(700, () =>
          this.shootBossBullet(this.boss.x, this.boss.y + this.boss.displayHeight/2, 0, 330, 2)
        );
        this.boss.lastSpecial = this.time.now;
      }

      // Suelta dos pildoras con separación durante la fase 2
      if (this.pillsPhase2Dropped < 2) {
        if (this.pillsPhase2Dropped === 0 && this.boss.health <= 280) {
          this.time.delayedCall(150, () => {
            this.dropLifePill(this.boss.x, this.boss.y + this.boss.displayHeight/2 + 8);
          });
          this.pillsPhase2Dropped++;
        } else if (this.pillsPhase2Dropped === 1 && this.boss.health <= 120) {
          this.time.delayedCall(400, () => {
            this.dropLifePill(this.boss.x, this.boss.y + this.boss.displayHeight/2 + 10);
          });
          this.pillsPhase2Dropped++;
        }
      }
    }
    // Cambio a fase 2
    if (this.boss.health<=375 && this.bossPhase===1) {
      this.bossPhase=2;
      this.boss.setTexture('boss2');
      this.bossTalk("¡Ahora verás mi verdadero poder!");
    }
  }

  shootBossBullet(x, y, velX, velY, power=1) {
    let bb = this.bossBullets.create(x, y, 'boss_bullet');
    bb.setScale(0.05)
      .setVelocity(velX,velY)
      .setCollideWorldBounds(false);
    bb.power = power;
  }

  shootEnemyBullet(x, y) {
    let bullet = this.enemyBullets.create(x, y, 'enemy_bullet');
    bullet.setVelocityY(140);
    bullet.setScale(0.7);
    bullet.setCollideWorldBounds(false);
  }

  dropLifePill(x, y) {
    let pill = this.lifePills.create(x, y, 'pill');
    pill.setVelocityY(90);
    pill.setScale(0.7);
    pill.setCollideWorldBounds(false);
  }

  // --- Callbacks colisión ---
  bulletHitsEnemy(b, e) {
    const x=e.x, y=e.y;
    b.destroy(); e.destroy();
    this.createExplosion(x,y,1);
    this.score+=10; this.scoreText.setText('Score: '+this.score);
  }
  bulletHitsMinion(b,m) {
    const x=m.x, y=m.y;
    b.destroy(); m.destroy();
    this.createExplosion(x,y,1);
    this.score+=5; this.scoreText.setText('Score: '+this.score);
  }
  bossBulletHitsPlayer(p,bb) {
    if (this.invulnerable) return;
    bb.destroy(); this.playerHit();
  }
  enemyBulletHitsPlayer(p,bullet) {
    if (this.invulnerable) return;
    bullet.destroy(); this.playerHit();
  }
  enemyHitsPlayer(p,e) {
    this.createExplosion(p.x,p.y,1.5);
    e.destroy(); this.playerHit();
  }
  bulletHitsBoss(b, boss) {
    b.destroy();
    boss.health -= this.playerUpgrades.attack * 10;
    boss.setTint(0xff4444);
    this.time.delayedCall(100, ()=> boss.clearTint());
    this.createExplosion(b.x,b.y,0.7);
    this.updateBossHealthBar();
  }
  playerGetsLife(player, pill) {
    pill.destroy();
    this.playerLives++;
    this.livesText.setText('Vidas: ' + this.playerLives);
    this.bossTalk('¡Una vida extra!');
  }
  playerHit() {
    this.playerLives--;
    this.livesText.setText('Vidas: '+this.playerLives);
    this.player.setTint(0xff4444);
    this.invulnerable=true;
    this.time.delayedCall(1200,()=>{ this.player.clearTint(); this.invulnerable=false; });
    if (this.playerLives<=0) this.scene.start('GameOverScene',{score:this.score});
  }

  updateBossHealthBar() {
    if (!this.boss || !this.bossHealthBar) return;
    let percent = Math.max(this.boss.health / 750, 0);
    this.bossHealthBar.width = 300 * percent;
    this.bossHealthBar.setFillStyle(percent > 0.5 ? 0x00ff44 : percent > 0.2 ? 0xffff44 : 0xff4444);
    this.bossHealthText.setText('Boss: ' + Math.max(this.boss.health, 0) + ' / 750' + (this.bossPhase > 1 ? " ⚡" : ""));
  }

  createExplosion(x,y,scale=1) {
    let boom = this.add.sprite(x,y,'explosion').setScale(scale);
    boom.play('explode');
  }

  bossTalk(text) {
    this.bossSpeech.setText(text).setVisible(true);
    this.bossTalkTimer = this.time.now;
  }
}


