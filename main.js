var config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 1200 }
    }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  },
  backgroundColor: "#999999"
};

var that;

var ROBOT_SPEED = 400;
var ROBOT_JUMP = 600;
var LASER_SPEED = 3500;
var MAX_ROBOT_SPEED = 2500;
var TARGET_SPEED = 600;

var currentLevel;
var currentLevelIndex = 0;
var currentDeathRate = 0;

var gladosBlink;

var robot;
var target;
var blocks;
var killers;
var reverser;
var victory;
var portal_blue;
var laser_blue;
var portal_yellow;
var laser_yellow;
var safezones;
var collectibles;

var dialogText;

var blocksCollider;

var isCreated = false;
var skipIntro = false;

var jump_sound_effect;
var collect_sound_effect;
var victory_sound_effect;
var death_sound_effect;

var cursors;
var targetUp, targetDown, targetLeft, targetRight;

var game = new Phaser.Game(config);

function preload() {
  var progress = this.add.graphics();
  var loadingText = this.add.text(400, 300, "", {
    font: "32px Courier",
    fill: "#333"
  });
  loadingText.setOrigin(0.5, 0.5);

  this.load.on("progress", function(value) {
    progress.clear();
    progress.fillStyle(0xffffff, 1);
    progress.fillRect(0, 270, 800 * value, 60);
    loadingText.text = "loading... " + Math.floor(100 * value) + "%";
  });

  that = this;
  this.load.on("complete", function() {
    progress.destroy();
    loadingText.destroy();
    that.sound.add("music", { loop: true, volume: 0.15 }).play();
  });

  that = this;

  this.load.audio(
    "music",
    "assets/sounds/Jesse_Spillane_-_05_-_All_Humans.mp3"
  );

  this.load.audio("jump_sound", "assets/sounds/phaseJump2.mp3");
  this.load.audio("collect_sound", "assets/sounds/powerUp6.mp3");
  this.load.audio("victory_sound", "assets/sounds/powerUp3.mp3");
  this.load.audio("death_sound", "assets/sounds/twoTone1.mp3");

  this.load.image("block_white", "assets/images/50x50-white.png");
  this.load.image("block_black", "assets/images/50x50-black.png");
  this.load.image("block_red", "assets/images/24x24-red.png");
  this.load.image("block_green", "assets/images/50x50-green.png");

  this.load.image("robot", "assets/images/50x50-pink.png");
  this.load.image("target", "assets/images/32x32-target.png");
  this.load.image("glados", "assets/images/glados.png");

  this.load.image("victory", "assets/images/12x12-green.png");
  this.load.image("portal_blue", "assets/images/12x12-blue.png");
  this.load.image("portal_yellow", "assets/images/12x12-yellow.png");

  this.load.image("reverser", "assets/images/12x12-check.png");
}

function loadLevel(level) {
  if (!level) return;

  // Add the sprite for the robot
  const [rx, ry] = level.robot.position;
  robot = that.physics.add.sprite(rx, ry, "robot");

  // Add blocks to the board
  blocks = that.physics.add.group({
    immovable: true,
    allowGravity: false
  });

  blocks.create(-25, 600, "block_white").setScale(1, 26);
  blocks.create(1625, 600, "block_white").setScale(1, 26);
  blocks.create(800, -25, "block_white").setScale(32, 1);
  blocks.create(800, 1125, "block_white").setScale(32, 1);

  if (level.blocks) {
    level.blocks.forEach(block => {
      const [x, y] = block.position;
      const [sX, sY] = block.scale;
      blocks.create(x, y, "block_black").setScale(sX, sY);
    });
  }

  blocksCollider = that.physics.add.collider(robot, blocks);

  // Add Safe zones to the board
  safezones = that.physics.add.group({
    immovable: true,
    allowGravity: false
  });

  if (level.safezones) {
    level.safezones.forEach(safe => {
      const [x, y] = safe.position;
      const [sX, sY] = safe.scale;
      safezones
        .create(x, y, "block_green")
        .setScale(sX, sY)
        .setAlpha(0.3);
    });
  }

  // Gravity Reverser
  reverser = that.physics.add.group({
    immovable: true,
    allowGravity: false
  });

  if (level.reversers) {
    level.reversers.forEach(block => {
      const [x, y] = block.position;
      reverser.create(x, y, "reverser").setScale(2, 1);
    });
  }

  that.physics.add.collider(reverser, robot, x => {
    that.physics.world.gravity.y *= -1;
  });

  // Killers
  killers = that.physics.add.group({
    immovable: false,
    allowGravity: false
  });

  if (level.killers) {
    level.killers.forEach(killer => {
      const [x, y] = killer.position;
      const [vX, vY] = killer.speed || [0, 0];
      const [sX, sY] = killer.scale || [1, 1];
      const k = killers.create(x, y, "block_red").setScale(sX, sY);
      k.setVelocity(vX, vY);
      k.setBounce(1);
    });
  }
  that.physics.add.collider(killers, blocks);
  that.physics.add.collider(killers, safezones);
  that.physics.add.overlap(killers, robot, robotDeath);

  // Add collectibles
  collectibles = that.physics.add.group({
    immovable: false,
    allowGravity: false
  });

  if (level.collectibles) {
    level.collectibles.forEach(collectible => {
      const [x, y] = collectible.position;
      collectibles.create(x, y, "victory").setScale(2);
    });
  }

  that.physics.add.overlap(robot, collectibles, collectPoint);

  // Add static image for victory condition
  const [x, y] = level.victory.position;
  const [sX, sY] = level.victory.scale;
  victory = that.physics.add
    .staticImage(x, y, "victory")
    .setScale(sX, sY)
    .refreshBody();
  that.physics.add.overlap(robot, victory, levelWon);

  // Resets the portals
  portal_blue = null;
  if (level.portal_blue) {
    const [x, y] = level.portal_blue.position;
    const [sX, sY] = level.portal_blue.scale;
    portal_blue = that.physics.add
      .staticImage(x, y, "portal_blue")
      .setScale(sX, sY)
      .refreshBody();
    portal_blue._DIRECTION = level.portal_blue.direction;
    that.physics.add.overlap(portal_blue, robot, teleportTo("yellow"));
  }
  portal_yellow = null;
  if (level.portal_yellow) {
    const [x, y] = level.portal_yellow.position;
    const [sX, sY] = level.portal_yellow.scale;
    portal_yellow = that.physics.add
      .staticImage(x, y, "portal_yellow")
      .setScale(sX, sY)
      .refreshBody();
    portal_yellow._DIRECTION = level.portal_yellow.direction;
    that.physics.add.overlap(portal_yellow, robot, teleportTo("blue"));
  }

  // Physic group for lasers
  laser_blue = that.physics.add.group();
  laser_yellow = that.physics.add.group();
  that.physics.add.collider(laser_blue, blocks, makePortal("blue"));
  that.physics.add.collider(laser_yellow, blocks, makePortal("yellow"));
  initCollider();

  // Creates the target
  if (level.robot.hasBlueGun) {
    target = that.physics.add.sprite(rx + 50, ry, "target");
    target.body.allowGravity = false;
    target.body.collideWorldBounds = true;
  }

  // Creates the introduction dialog
  if (!skipIntro) {
    pauseWithDialog(level.intro || "hello world....", () => {
      skipIntro = true;
      that.physics.resume();
    });
  }
}

function collectPoint(_, collectible) {
  collectible.destroy();
  collect_sound_effect.play();
}

function levelWon() {
  if (collectibles.getChildren().length > 0) return;
  victory_sound_effect.play();
  pauseWithDialog(currentLevel.onWinText || "You won!", () => {
    currentLevelIndex = currentLevelIndex + 1;
    skipIntro = false;
    that.scene.restart();
  });
}

function pauseWithDialog(dialog, callback) {
  that.physics.pause();

  var background = that.add.graphics();
  background.fillStyle(0xd6c7c7, 0.25);
  background.fillRect(0, 0, 1600, 1100);

  var bubble = that.add.graphics();
  bubble.fillStyle(0x121212);
  bubble.fillRoundedRect(290, 590, 1270, 470, 52);
  bubble.fillStyle(0x444444);
  bubble.fillRoundedRect(300, 600, 1250, 450, 42);

  var style = {
    font: "64px Courier",
    fill: "#eee"
  };

  dialogText = that.add.text(360, 640, "", style);
  dialogText.setShadow(6, 6, "rgba(0,0,0,0.5)", 6);

  glados = that.physics.add.staticImage(150, 725, "glados");
  glados.setScale(4);

  gladosBlink = that.add.graphics();
  gladosBlink.fillStyle(0xffff22, 1.0);
  gladosBlink.fillCircle(140, 790, 30, 60);

  var k = 0;
  that.time.addEvent({
    delay: 40,
    callback: () => {
      k = k + 1;
      dialogText.text = dialog.slice(0, k);

      if (k == dialog.length) {
        that.input.keyboard.once("keydown", () => {
          bubble.destroy();
          background.destroy();
          dialogText.destroy();
          glados.destroy();
          gladosBlink.destroy();
          if (callback) callback();
        });
      }
    },
    callbackScope: null,
    repeat: dialog.length
  });
}

function displayHud() {
  graphics = that.add.graphics();
  graphics.fillStyle(0x555555, 1.0);
  graphics.fillRoundedRect(0, -100, 1600, 100, { tl: 0, tr: 0, bl: 0, br: 0 });

  var style = {
    font: "56px Courier",
    fill: "#eee",
    boundsAlignH: "center",
    boundsAlignV: "middle"
  };

  textHudLevel = that.add
    .text(20, -80, "Level: " + (currentLevelIndex + 1), style)
    .setOrigin(0, 0);
  textHudLevel.setShadow(6, 6, "rgba(0,0,0,0.5)", 6);

  textHudLevelName = that.add
    .text(800, -80, currentLevel.name, style)
    .setOrigin(0.5, 0);
  textHudLevelName.setShadow(6, 6, "rgba(0,0,0,0.5)", 6);

  textHudDeath = that.add
    .text(1580, -80, "Death: " + currentDeathRate, style)
    .setOrigin(1, 0);
  textHudDeath.setShadow(6, 6, "rgba(0,0,0,0.5)", 6);
}

function create() {
  isCreated = false;

  this.cameras.main.setBounds(0, -100, 1600, 1400);
  this.physics.world.setBounds(0, 0, 1600, 1100);

  // Register the keyboard for receiving inputs
  cursors = this.input.keyboard.createCursorKeys();
  targetUp = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
  targetDown = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
  targetRight = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
  targetLeft = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);

  // Starts playing an amazing
  // this.sound.add("space_music", { loop: true }).play();
  jump_sound_effect = this.sound.add("jump_sound", { loop: false });
  collect_sound_effect = this.sound.add("collect_sound", { loop: false });
  victory_sound_effect = this.sound.add("victory_sound", {
    loop: false,
    volume: 0.25
  });
  death_sound_effect = this.sound.add("death_sound", { loop: false });

  // Camera
  this.cameras.main.setZoom(0.5);

  // Level
  //const levelName = "chapter5/level3";
  const levelName = levelNames[currentLevelIndex] || "level99";
  const requestURL = "levels/" + levelName + ".json";
  // requestURL = "levels/chapter4/level1.json";
  var request = new XMLHttpRequest();
  request.open("GET", requestURL);
  request.setRequestHeader("Cache-Control", "no-cache");
  request.responseType = "json";
  request.onload = function() {
    currentLevel = request.response;
    loadLevel(currentLevel);
    isCreated = true;
    // Hud
    displayHud();
  };
  request.send();

  that.input.keyboard.on("keydown", shootLaser);
}

const robotDeath = () => {
  currentDeathRate += 1;
  death_sound_effect.play();
  pauseWithDialog(currentLevel.onDeathText || "You're dead", () =>
    that.scene.restart()
  );
};

const initCollider = () => {
  if (blocksCollider) blocksCollider.destroy();
  blocksCollider = that.physics.add.collider(robot, blocks);
};

const makePortal = color => laser => {
  const otherColor = color == "blue" ? "yellow" : "blue";
  var new_portal = that.physics.add.staticImage(
    laser.x,
    laser.y,
    "portal_" + color
  );
  that.physics.add.overlap(new_portal, robot, teleportTo(otherColor));
  //that.physics.add.overlap(new_portal, killers, teleportTo(otherColor));

  if (laser.body.touching.right) {
    new_portal._DIRECTION = "LEFT";
  } else if (laser.body.touching.left) {
    new_portal._DIRECTION = "RIGHT";
  } else if (laser.body.touching.up) {
    new_portal._DIRECTION = "DOWN";
  } else {
    new_portal._DIRECTION = "UP";
  }

  if (laser.body.touching.right || laser.body.touching.left) {
    new_portal.setScale(1, 6).refreshBody();
  } else {
    new_portal.setScale(6, 1).refreshBody();
  }

  if (color == "blue") {
    if (portal_blue) {
      portal_blue.destroy();
    }
    portal_blue = new_portal;
  } else {
    if (portal_yellow) {
      portal_yellow.destroy();
    }
    portal_yellow = new_portal;
  }
  laser.destroy();
  initCollider();
};

const teleportTo = color => (_, item) => {
  var vX, vY, dX, dY;
  const _vX = item.body.velocity.x;
  const _vY = item.body.velocity.y;

  var portalTo = { blue: portal_blue, yellow: portal_yellow }[color];
  var portalFrom = { blue: portal_yellow, yellow: portal_blue }[color];

  if (!portalTo) {
    portalTo = portalFrom;
  }

  dX = { UP: 0, DOWN: 0, LEFT: -32, RIGHT: 32 }[portalTo._DIRECTION];
  dY = { UP: -32, DOWN: 32, LEFT: 0, RIGHT: 0 }[portalTo._DIRECTION];

  var vA = {
    UP: _vY,
    DOWN: -_vY,
    RIGHT: -_vX,
    LEFT: _vX
  }[portalFrom._DIRECTION];

  var vO = {
    UP: _vX,
    DOWN: -_vX,
    RIGHT: -_vY,
    LEFT: _vY
  }[portalFrom._DIRECTION];

  vA = Math.max(120, Math.min(MAX_ROBOT_SPEED, Math.abs(vA)));
  vO = Math.min(MAX_ROBOT_SPEED, vO);

  item.body.x = portalTo.x + dX - 25;
  item.body.y = portalTo.y + dY - 25;

  if (portalTo._DIRECTION == "UP") {
    item.setVelocity(vO, -vA);
  } else if (portalTo._DIRECTION == "DOWN") {
    item.setVelocity(-vO, vA);
  } else if (portalTo._DIRECTION == "RIGHT") {
    item.setVelocity(vA, -vO);
  } else if (portalTo._DIRECTION == "LEFT") {
    item.setVelocity(-vA, vO);
  }
};

const shootLaser = key => {
  if (key.keyCode != 32) return;

  const level = currentLevel.robot;
  const canShoot = cursors.shift.isDown ? level.hasYellowGun : level.hasBlueGun;
  if (!canShoot) return;

  const laser_group = cursors.shift.isDown ? laser_yellow : laser_blue;
  const laser_image = cursors.shift.isDown ? "portal_yellow" : "portal_blue";

  // Shooting a laser
  var speedX = target.x - robot.x;
  var speedY = target.y - robot.y;
  var norm = (speedX ** 2 + speedY ** 2) ** 0.5;
  if (norm > 0) {
    var laser = laser_group.create(robot.x, robot.y, laser_image);
    laser.body.allowGravity = false;
    laser.setVelocity(
      (LASER_SPEED * speedX) / norm,
      (LASER_SPEED * speedY) / norm
    );
  }
};

function update(time, delta) {
  if (!isCreated) return;

  if (target) {
    if (targetDown.isDown) target.setVelocityY(TARGET_SPEED);
    else if (targetUp.isDown) target.setVelocityY(-TARGET_SPEED);
    else target.setVelocityY(0);

    if (targetRight.isDown) target.setVelocityX(TARGET_SPEED);
    else if (targetLeft.isDown) target.setVelocityX(-TARGET_SPEED);
    else target.setVelocityX(0);
  }

  if (gladosBlink) gladosBlink.setAlpha(1 - Math.cos(time / 640) ** 6);

  const v = robot.body.velocity.x;
  const gSign = that.physics.world.gravity.y < 0 ? 1 : -1;

  const onTheGround =
    (robot.body.touching.down && gSign < 0) ||
    (robot.body.touching.up && gSign > 0);

  if (onTheGround) robot.setVelocityX(0.85 * v);
  else robot.setVelocityX(1 * v);

  // Moving left and right
  if (cursors.left.isDown) {
    robot.setVelocityX(v < -ROBOT_SPEED ? v : Math.max(-ROBOT_SPEED, v - 35));
  } else if (cursors.right.isDown) {
    robot.setVelocityX(v > ROBOT_SPEED ? v : Math.min(ROBOT_SPEED, v + 35));
  }

  // Jumping
  if (cursors.up.isDown && onTheGround) {
    robot.setVelocityY(gSign * ROBOT_JUMP);
    jump_sound_effect.play();
  }
}
