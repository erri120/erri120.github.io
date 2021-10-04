---
title: Don't count frames for determining time
date: 2021-09-29 16:21:15
categories:
  - Game Development
tags:
  - RPG Maker
---

## What not to do

Lets say you want to add a "Playtime" field to a save file. In the save menu the player should be able to see how long they have played your game. So how do you implement this? If you are one of the RPG Maker MV developers then you will count the number of rendered frames, store them in the save file and divide them by 60 to get the amount of seconds passed.

A little bit of background: I recently played an RPG Maker MV game for around 21 hours but the save menu said it was over 51 hours, more than double. This made me very curious and I assumed it had something to do with some speed shenanigans when using sprinting instead of walking. Since RPG Maker uses JavaScript for everything you can just open the `js` folder and look at the code. After a quick search for "Playtime" related terms I found these gems:

```javascript
Game_System.prototype.onBeforeSave = function() {
    this._framesOnSave = Graphics.frameCount;
    // ...
};

Game_System.prototype.onAfterLoad = function() {
    Graphics.frameCount = this._framesOnSave;
    // ...
};

Game_System.prototype.playtime = function() {
    return Math.floor(Graphics.frameCount / 60);
};

Game_System.prototype.playtimeText = function() {
    var hour = Math.floor(this.playtime() / 60 / 60);
    var min = Math.floor(this.playtime() / 60) % 60;
    var sec = this.playtime() % 60;
    return hour.padZero(2) + ':' + min.padZero(2) + ':' + sec.padZero(2);
};
```

Turns out that RPG Maker MV uses `Graphics.frameCount` for determining the playtime. In case you are wondering: `Graphics.frameCount` gets updated on every render in the `Graphics.render` function. The engine developers assumed that you will always be running the game at a stable 60 frames per second. At this rate you _can_ get the number of seconds passed but what if you are not running the game at 60 fps? In my case I am playing the game on a 144hz display with VSync enabled meaning my machine rendered 2.4 times more frames than expected.

Using some quick maths we can calculate the actual time passed at 144 fps:

```txt
50h = 180000sec
180000sec / 2.4 = 75000sec
75000sec = 20.8h
```

Criticising people for bad code is always fun but lets rather look at some alternative solutions to this problem.

## What to do instead

Whenever you deal with anything frame related you must use real time at one point or another. Not only can players run the game at different frames per second, but the time it takes between each frame can also be inconsistent. Bethesda and their Creation Engine is another example of bad frame based behaviour and running games made with it above 60 fps often breaks physics. The game engine Unity solved this issue eons ago by introducing `Time.deltaTime` which contains the amount of seconds passed between the current and last frame. This delta time is used basically everywhere in functions that get called every frame and deal with timely operations like changing the position of an object over time:

```csharp
object.transform.position += Vector3.forward * 5f * Time.deltaTime;
```

It is possible to use the amount of frames as an indicator for how much time has passed but there are too many problems and pitfalls that it makes no sense to go this route. My guess is that some developer thought too hard about this problem and came up with a solution that worked in the development environment.

We want to know amount of time passed while playing the game so how about we just use the time given to us by the operating system? Set a start time and calculate the difference between now and the start time on save:

- on load/start: set `startTime` to the current time
- on save:
  1) get the current time and calculate the difference between now and `startTime`
  2) add the difference to a variable in the save object and serialize to disk

## Changing the implementation in RPG Maker MV

Start by opening `js/rpg_objects.js` and look for the `initialize` function. Here we want to add two new properties:

```javascript
Game_System.prototype.initialize = function() {
  this._startTime = Date.now();
  this._playtime = 0;
  // ...
}
```

`Date.now()` returns the current [Unix time](https://currentmillis.com/) as an integer that looks like this: `1632928643900`.

We need to set the start time in the `initialize` function for when the game starts and in the `onAfterLoad` function for when the player loads a save file:

```javascript
Game_System.prototype.onAfterLoad = function() {
  this._startTime = Date.now();
  // ...
}
```

The `onBeforeSave` function gets called before the save is serialized so here we have to calculate the time difference and reset the start time:

```javascript
Game_System.prototype.onBeforeSave = function() {
  this._playtime += Date.now() - this._startTime;
  this._startTime = Date.now();
  // ...
}
```

Assuming the player started at `1632928643900` and played for 1 second till `1632928644900`, `this._playtime` will now be `1000`. The only thing remaining is updating the `playtime` function:

```javascript
Game_System.prototype.playtime = function() {
  return Math.floor(this._playtime / 1000);
};
```

Since this function returns the amount of time passed in seconds we have to divide by 1000 to convert from milliseconds to seconds. While we are at it, I also recommend updating `playtimeText`:

```javascript
Game_System.prototype.playtimeText = function() {
  var secondsPassed = this.playtime();

  var sec = secondsPassed % 60;
  var min = Math.floor(secondsPassed / 60) % 60;
  var hour = Math.floor(secondsPassed / 60 / 60) % 24;

  return hour.padZero(2) + ':' + min.padZero(2) + ':' + sec.padZero(2);
};
```

## Conclusion

Don't count frames for determining real time spans.