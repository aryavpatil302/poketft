---
title: "Balancing"
description: "One person can't playtest their way to a balanced game. Here's the data pipeline, and the fake Reddit forum, that I used to supplement."
date: 2026-08-16
draft: false
---

By myself, I can't playtest my way to a balanced game. That sounds obvious once I say it out loud, but it took me longer than I'd like to admit to actually act on it. By myself, even playing every night that I could, I might get through a few hundred games in a season. A single outlier trait combination, one that's quietly winning 80% of its fights, can hide in a sample that small forever. I needed a way to see patterns across thousands of games I'd never personally sit through, and then I needed a second way to see how those patterns actually feel from inside a single game, stage by stage, to get both the micro and macro views on the state of the game's balance.

That scale problem is one I tackled with a report generation process.

![The bot league report's unit overview: cards for every unit ranked by board win rate, with damage dealt and taken colored against same-archetype peers](./balancing/report-units-overview.png)
*The first thing I open after any change, every unit's win rate off a single 100-game run.*

That second part, damage over time, helped me dig into how a unit functions and if it's acting correctly according to its intended design. A unit that deals its damage in the first five seconds and a unit that deals the same total damage but ramps up over the whole fight are doing completely different jobs, even if their end-of-fight totals look identical on a spreadsheet. I wanted to see the shape of a fight and not just its outcome.

![A single fight's damage breakdown for Armarouge: a cumulative damage-dealt chart with a kill annotated, next to a cumulative damage chart with one line per unit on the board](./balancing/report-armarouge-single-game.png)
*The shape of one real fight, not just its final number, one line per unit on the board.*

The report also compares units against their own peer group. Comparing a tank's win rate to a marksman's doesn't tell me much since they're not doing the same job. Comparing a tank's win rate to other tanks tells me immediately who's overperforming and who's dead weight. I lean on that constantly: a little up arrow next to a unit means it's punching above its archetype, a down arrow means something's off, and I don't have to eyeball a wall of numbers to find either one.

![Armarouge's detail page: board win rate, damage and taken per round, trait contribution breakdown, and a per-star-level split with up arrows against archetype peers](./balancing/report-armarouge-detail.png)
*Every unit gets this drill-down, arrows colored against its own archetype instead of the whole roster.*

None of that tells me how it feels to actually play against the thing, though, and feel is where a lot of real balance problems hide. A trait can average out to a perfectly reasonable 50% win rate while actually being miserable, curb-stomping half its games and doing nothing the other half, and an average just flattens that tension into a number that looks fine on paper. I wanted a signal that couldn't hide behind an average, so I built something that isn't a report at all. I often scroll through TFT subreddits to see other players' opinions on the state of the game, which gave me the idea to build a version of my own to see what my bots thought about the meta. Hundreds of bot personas, each with their own name and a little bit of personality, posting about the game like actual players would, based on what's actually happening in the simulated data underneath.

I could've had these bots say "Tangela has a 34% win rate in this matchup," and it would've told me nothing I couldn't already get from the report. I wanted to focus on the player's perception and experience instead. So one of them posts something like "every time I lean on Tangela and expect it to hold a fight, I lose that fight, every single time lately," and a few replies later someone's pushing back, asking whether Tangela is actually bad or just the unit every losing board happens to be holding because it's cheap and everyone's got a spare copy. That back and forth is what helps me see the different sides of the set, and what the key things are that aren't landing at the moment.

![The Shop Talk feed, showing threads titled "the shiny buy-priority order," "ok but wide boards just keep winning," "alright i need to walk back some of my jungle take," and "ok genuinely, is armarouge supposed to just... always win?"](./balancing/shop-talk-feed.png)
*The whole feed at a glance, TangelaTruther's walk-back sitting right next to the thread calling Armarouge broken.*

I've caught things this way I don't think I would've noticed in the raw tables. One thread argued that wide boards, three or four traits half-lit at once, were quietly outperforming anything built around one or two deep commitments, and the replies split exactly the way a real balance debate splits, some people insisting the width was the reason they were winning, others insisting they only had the luxury of going wide because they were already winning.

![A Shop Talk thread claiming a Volcano/Spellweaver burn-stack comp wins every lobby, with nested replies confirming the board and pinpointing why: two trait payoffs stacking off the same casts](./balancing/shop-talk-volcano-thread.png)
*A different comp, same pattern, replies converging on the actual mechanical reason instead of just agreeing it's strong.*

Another post had a bot asking if the unit Armarouge was overpowered, noticing how it was winning most of its fights. The comments agreed, talking about their own experiences with the unit. This was a strong signal for me to look closer, so I checked the report for Armarouge's damage breakdown to see which levers I could pull to bring it back in line with other units.

The report tells me what happened, at a scale no single playthrough could ever show me: this unit's win rate, this trait's breakpoint value, this ability's damage curve, this shiny's actual pull rate across thousands of shops. The forum tells me what it felt like from inside one of those games, which is where I actually notice the polarizing trait, the ability that reads as unfair even when its numbers are fine, the base stat that's quietly too good because nobody's complaining about the unit that's supposed to be a filler pick. I need both, because numbers without feel miss the human experience of playing the game, and feel without numbers underneath it is just noise dressed up as insight.

Between the two, I get something close to what an actual playerbase would hand a solo designer for free: a pile of hard data and a pile of complaints, contradicting each other exactly the way real ones would. I still have to decide what to do with either one. But I'm not flying blind anymore, which is the difference between slowly chipping away at balance from personal experience and making overarching decisions backed by real data.
