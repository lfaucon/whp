# World Hardest Portal

A game made for the jam [Game Off 2018](https://itch.io/jam/game-off-2018)

## Theme

This game was intented as an hybrid between a 2D portal-like game and the world hardest game

## Play

You can play the game at that [link](https://lfaucon.github.io/whp/)

## Around the code

Each level is described as a json file in he folder `levels/`. This file must describe

- `robot`: initial position of the robot and whether the robot can send blue or yellow portals
- `blocks`: position of the black blocks
- `killers`: position, initial speed and scale of the red blocks
- `collectibles`: position of the green blocks
- `victory`: position and scale of the victory portal

The mechanics of the game are all written in the file `main.js`

Images and sounds are in the `assets/` folder

## Attribution

The game was implemented using the game engine Phaser 3.

The game uses the music All Humans by Jesse Spillane.
