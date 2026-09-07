import {
  system,
  world,
  Player,
  EquipmentSlot,
  EntityComponentTypes,
  CustomCommandStatus,
  CustomCommandParamType,
  CommandPermissionLevel,
  PlayerPermissionLevel,
  InputPermissionCategory,
  HudVisibility,
} from "@minecraft/server";

import {
  ActionFormData,
  ModalFormData,
} from "@minecraft/server-ui";


// ============================================================
// DEFAULT SETTINGS
// ============================================================

const DEFAULT_SETTINGS = {
  respawnTitle: "Respawing...",
  hideHud: true,
  clearInventory: true,
  restoreInventory: true,
  freezeMovement: false,
  playSounds: true,

  effects: {
    invisibility: { enabled: true, amplifier: 0 },
    resistance: { enabled: true, amplifier: 1 },
    weakness: { enabled: true, amplifier: 0 },
    blindness: { enabled: true, amplifier: 0 },
    miningFatigue: { enabled: true, amplifier: 255 },
    regeneration: { enabled: true, amplifier: 0 },
    waterBreathing: { enabled: true, amplifier: 0 },
  },
};


// ============================================================
// SETTINGS COPY
// ============================================================

function copySettings(source) {
  return {
    respawnTitle: source.respawnTitle,
    hideHud: source.hideHud,
    clearInventory: source.clearInventory,
    restoreInventory: source.restoreInventory,
    freezeMovement: source.freezeMovement,
    playSounds: source.playSounds,

    effects: {
      invisibility: {
        enabled: source.effects.invisibility.enabled,
        amplifier: source.effects.invisibility.amplifier,
      },

      resistance: {
        enabled: source.effects.resistance.enabled,
        amplifier: source.effects.resistance.amplifier,
      },

      weakness: {
        enabled: source.effects.weakness.enabled,
        amplifier: source.effects.weakness.amplifier,
      },

      blindness: {
        enabled: source.effects.blindness.enabled,
        amplifier: source.effects.blindness.amplifier,
      },

      miningFatigue: {
        enabled: source.effects.miningFatigue.enabled,
        amplifier: source.effects.miningFatigue.amplifier,
      },

      regeneration: {
        enabled: source.effects.regeneration.enabled,
        amplifier: source.effects.regeneration.amplifier,
      },

      waterBreathing: {
        enabled: source.effects.waterBreathing.enabled,
        amplifier: source.effects.waterBreathing.amplifier,
      },
    },
  };
}


let settings = copySettings(
  DEFAULT_SETTINGS
);


// ============================================================
// EFFECT LIST
// ============================================================

const EFFECT_ROWS = [
  {
    key: "invisibility",
    label: "Invisibility",
    id: "minecraft:invisibility",
  },

  {
    key: "resistance",
    label: "Resistance",
    id: "minecraft:resistance",
  },

  {
    key: "weakness",
    label: "Weakness",
    id: "minecraft:weakness",
  },

  {
    key: "blindness",
    label: "Blindness",
    id: "minecraft:blindness",
  },

  {
    key: "miningFatigue",
    label: "Mining Fatigue",
    id: "minecraft:mining_fatigue",
  },

  {
    key: "regeneration",
    label: "Regeneration",
    id: "minecraft:regeneration",
  },

  {
    key: "waterBreathing",
    label: "Water Breathing",
    id: "minecraft:water_breathing",
  },
];


// ============================================================
// ACTIVE SESSIONS
// ============================================================

const activeSessions = new Map();


// ============================================================
// TRUSTED TAGS
// ============================================================

const TRUSTED_TAGS = [
  "admin",
  "op",
  "mod",
  "operator",
];


// ============================================================
// GET COMMAND SOURCE PLAYER
// ============================================================

function getSourcePlayer(origin) {
  const source =
    origin.initiator ??
    origin.sourceEntity ??
    null;

  return source instanceof Player
    ? source
    : undefined;
}


// ============================================================
// PERMISSION CHECK
// ============================================================

function isTrustedPlayer(player) {
  if (!(player instanceof Player)) {
    return false;
  }

  const tags = player
    .getTags()
    .map((tag) =>
      String(tag).toLowerCase()
    );

  if (
    tags.some((tag) =>
      TRUSTED_TAGS.includes(tag)
    )
  ) {
    return true;
  }

  try {
    return (
      player.playerPermissionLevel ===
      PlayerPermissionLevel.Operator
    );
  } catch {
    return false;
  }
}


// ============================================================
// INVENTORY SNAPSHOT
// ============================================================

function snapshotPlayer(player) {
  const snapshot = {
    inventory: [],
    armor: {},
    offhand: undefined,
  };


  try {
    const inventory =
      player.getComponent(
        EntityComponentTypes.Inventory
      );

    if (inventory && inventory.container) {
      for (
        let i = 0;
        i < inventory.container.size;
        i++
      ) {
        const item =
          inventory.container.getItem(i);

        snapshot.inventory[i] =
          item ? item.clone() : undefined;
      }
    }
  } catch (error) {
    console.warn(
      `[DeathReset] Inventory snapshot failed: ${error}`
    );
  }


  try {
    const equipment =
      player.getComponent(
        EntityComponentTypes.Equippable
      );

    if (equipment) {
      const armorSlots = [
        EquipmentSlot.Head,
        EquipmentSlot.Chest,
        EquipmentSlot.Legs,
        EquipmentSlot.Feet,
      ];

      for (const slot of armorSlots) {
        const item =
          equipment.getEquipment(slot);

        snapshot.armor[slot] =
          item ? item.clone() : undefined;
      }


      const offhand =
        equipment.getEquipment(
          EquipmentSlot.Offhand
        );

      snapshot.offhand =
        offhand ? offhand.clone() : undefined;
    }
  } catch (error) {
    console.warn(
      `[DeathReset] Equipment snapshot failed: ${error}`
    );
  }

  return snapshot;
}


// ============================================================
// CLEAR INVENTORY
// ============================================================

function clearPlayerInventory(player) {
  try {
    const inventory =
      player.getComponent(
        EntityComponentTypes.Inventory
      );

    if (inventory && inventory.container) {
      inventory.container.clearAll();
    }
  } catch (error) {
    console.warn(
      `[DeathReset] Inventory clear failed: ${error}`
    );
  }


  try {
    const equipment =
      player.getComponent(
        EntityComponentTypes.Equippable
      );

    if (equipment) {
      equipment.setEquipment(
        EquipmentSlot.Head,
        undefined
      );

      equipment.setEquipment(
        EquipmentSlot.Chest,
        undefined
      );

      equipment.setEquipment(
        EquipmentSlot.Legs,
        undefined
      );

      equipment.setEquipment(
        EquipmentSlot.Feet,
        undefined
      );

      equipment.setEquipment(
        EquipmentSlot.Offhand,
        undefined
      );
    }
  } catch (error) {
    console.warn(
      `[DeathReset] Equipment clear failed: ${error}`
    );
  }
}


// ============================================================
// RESTORE INVENTORY
// ============================================================

function restorePlayer(player, snapshot) {
  if (!snapshot) {
    return;
  }


  try {
    const inventory =
      player.getComponent(
        EntityComponentTypes.Inventory
      );

    if (inventory && inventory.container) {
      inventory.container.clearAll();

      for (
        let i = 0;
        i < snapshot.inventory.length;
        i++
      ) {
        const item =
          snapshot.inventory[i];

        if (item) {
          inventory.container.setItem(
            i,
            item.clone()
          );
        }
      }
    }
  } catch (error) {
    console.warn(
      `[DeathReset] Inventory restore failed: ${error}`
    );
  }


  try {
    const equipment =
      player.getComponent(
        EntityComponentTypes.Equippable
      );

    if (equipment) {
      const armorSlots = [
        EquipmentSlot.Head,
        EquipmentSlot.Chest,
        EquipmentSlot.Legs,
        EquipmentSlot.Feet,
      ];

      for (const slot of armorSlots) {
        const item =
          snapshot.armor[slot];

        equipment.setEquipment(
          slot,
          item ? item.clone() : undefined
        );
      }


      equipment.setEquipment(
        EquipmentSlot.Offhand,
        snapshot.offhand
          ? snapshot.offhand.clone()
          : undefined
      );
    }
  } catch (error) {
    console.warn(
      `[DeathReset] Equipment restore failed: ${error}`
    );
  }
}


// ============================================================
// HUD
// ============================================================

function hideHud(player) {
  try {
    player.onScreenDisplay.setHudVisibility(
      HudVisibility.Hide
    );
  } catch (error) {
    console.warn(
      `[DeathReset] HUD hide failed: ${error}`
    );
  }
}


function restoreHud(player) {
  try {
    player.onScreenDisplay.setHudVisibility(
      HudVisibility.Reset
    );
  } catch (error) {
    console.warn(
      `[DeathReset] HUD restore failed: ${error}`
    );
  }
}


// ============================================================
// MOVEMENT
// ============================================================

function setMovementLocked(
  player,
  locked
) {
  try {
    player.inputPermissions.setPermissionCategory(
      InputPermissionCategory.Movement,
      !locked
    );
  } catch (error) {
    console.warn(
      `[DeathReset] Movement permission failed: ${error}`
    );
  }
}


// ============================================================
// EFFECTS
// ============================================================

function applyEffects(
  player,
  durationSeconds
) {
  const durationTicks =
    Math.max(
      1,
      Math.min(
        durationSeconds * 20,
        20000000
      )
    );


  for (const effect of EFFECT_ROWS) {
    const config =
      settings.effects[effect.key];

    if (!config || !config.enabled) {
      continue;
    }


    try {
      player.addEffect(
        effect.id,
        durationTicks,
        {
          amplifier:
            config.amplifier,

          showParticles: false,
        }
      );
    } catch (error) {
      console.warn(
        `[DeathReset] Failed to add ${effect.label}: ${error}`
      );
    }
  }
}


// ============================================================
// CLEAR EFFECTS
// ============================================================

function clearEffects(player) {
  for (const effect of EFFECT_ROWS) {
    try {
      player.removeEffect(
        effect.id
      );
    } catch {
      // Ignore.
    }
  }
}


// ============================================================
// SOUND
// ============================================================

function playResetSound(player) {
  if (!settings.playSounds) {
    return;
  }

  try {
    player.playSound(
      "random.orb"
    );
  } catch {
    // Ignore.
  }
}


// ============================================================
// FINISH RESET
// ============================================================

function finishSession(playerName) {
  const session =
    activeSessions.get(
      playerName
    );

  if (!session) {
    return;
  }


  activeSessions.delete(
    playerName
  );


  const player =
    world
      .getPlayers()
      .find(
        (p) =>
          p.name === playerName
      );


  if (!player) {
    return;
  }


  try {
    player.removeTag(
      "deathreset:dead"
    );
  } catch {
    // Ignore.
  }


  try {
    player.teleport(
      session.location
    );
  } catch (error) {
    console.warn(
      `[DeathReset] Teleport failed: ${error}`
    );
  }


  clearEffects(player);


  if (settings.restoreInventory) {
    restorePlayer(
      player,
      session.inventory
    );
  }


  if (settings.hideHud) {
    restoreHud(player);
  }


  setMovementLocked(
    player,
    false
  );


  try {
    player.onScreenDisplay.setTitle(
      "",
      {
        fadeInDuration: 0,
        stayDuration: 0,
        fadeOutDuration: 0,
      }
    );

    player.onScreenDisplay.updateSubtitle(
      ""
    );
  } catch {
    // Ignore.
  }


  playResetSound(player);
}


// ============================================================
// START RESET
// ============================================================

function startReset(
  target,
  x,
  y,
  z,
  seconds
) {
  if (!(target instanceof Player)) {
    return false;
  }


  if (
    activeSessions.has(
      target.name
    )
  ) {
    return false;
  }


  const duration =
    Math.max(
      1,
      Math.floor(seconds)
    );


  const session = {
    location: {
      x: Number(x),
      y: Number(y),
      z: Number(z),
    },

    inventory:
      snapshotPlayer(target),

    remaining:
      duration,

    intervalId:
      undefined,
  };


  activeSessions.set(
    target.name,
    session
  );


  target.addTag(
    "deathreset:dead"
  );


  // HUD FIRST.
  if (settings.hideHud) {
    hideHud(target);
  }


  // INVENTORY SECOND.
  if (settings.clearInventory) {
    clearPlayerInventory(
      target
    );
  }


  if (settings.freezeMovement) {
    setMovementLocked(
      target,
      true
    );
  } else {
    setMovementLocked(
      target,
      false
    );
  }


  applyEffects(
    target,
    duration + 5
  );


  try {
    target.onScreenDisplay.setTitle(
      settings.respawnTitle,
      {
        subtitle:
          String(duration),

        fadeInDuration: 0,
        stayDuration: 40,
        fadeOutDuration: 0,
      }
    );
  } catch (error) {
    console.warn(
      `[DeathReset] Title error: ${error}`
    );
  }


  playResetSound(target);


  session.intervalId =
    system.runInterval(
      () => {
        const current =
          activeSessions.get(
            target.name
          );


        if (!current) {
          system.clearRun(
            session.intervalId
          );

          return;
        }


        current.remaining--;


        if (
          current.remaining <= 0
        ) {
          system.clearRun(
            current.intervalId
          );

          finishSession(
            target.name
          );

          return;
        }


        try {
          target.onScreenDisplay.setTitle(
            settings.respawnTitle,
            {
              subtitle:
                String(
                  current.remaining
                ),

              fadeInDuration: 0,
              stayDuration: 40,
              fadeOutDuration: 0,
            }
          );
        } catch {
          // Ignore.
        }
      },
      20
    );


  return true;
}


// ============================================================
// SETTINGS MENU
// ============================================================

async function openSettingsMenu(player) {
  const form =
    new ActionFormData();

  form.title(
    "DeathReset Settings"
  );

  form.body(
    "Choose a settings category."
  );

  form.button(
    "General Settings"
  );

  form.button(
    "Effects"
  );

  form.button(
    "Reset Defaults"
  );

  form.button(
    "Close"
  );


  try {
    const result =
      await form.show(player);


    if (result.canceled) {
      return;
    }


    if (result.selection === 0) {
      await openGeneralSettings(
        player
      );
    }


    if (result.selection === 1) {
      await openEffectsSettings(
        player
      );
    }


    if (result.selection === 2) {
      settings =
        copySettings(
          DEFAULT_SETTINGS
        );

      player.sendMessage(
        "§aDeathReset settings reset to defaults."
      );

      await openSettingsMenu(
        player
      );
    }
  } catch (error) {
    player.sendMessage(
      `§cSettings error: ${error}`
    );

    console.warn(
      `[DeathReset] Settings error: ${error}`
    );
  }
}


// ============================================================
// GENERAL SETTINGS
// ============================================================

async function openGeneralSettings(player) {
  const form =
    new ModalFormData();

  form.title(
    "General Settings"
  );


  form.textField(
    "Respawn title",
    "Title",
    {
      defaultValue:
        settings.respawnTitle,
    }
  );


  form.toggle(
    "Hide HUD while dead",
    {
      defaultValue:
        settings.hideHud,
    }
  );


  form.toggle(
    "Clear inventory",
    {
      defaultValue:
        settings.clearInventory,
    }
  );


  form.toggle(
    "Restore inventory",
    {
      defaultValue:
        settings.restoreInventory,
    }
  );


  form.toggle(
    "Freeze movement",
    {
      defaultValue:
        settings.freezeMovement,
    }
  );


  form.toggle(
    "Play sounds",
    {
      defaultValue:
        settings.playSounds,
    }
  );


  try {
    const result =
      await form.show(player);


    if (result.canceled) {
      await openSettingsMenu(
        player
      );

      return;
    }


    settings.respawnTitle =
      String(
        result.formValues[0] ??
        "Respawing..."
      );


    settings.hideHud =
      Boolean(
        result.formValues[1]
      );


    settings.clearInventory =
      Boolean(
        result.formValues[2]
      );


    settings.restoreInventory =
      Boolean(
        result.formValues[3]
      );


    settings.freezeMovement =
      Boolean(
        result.formValues[4]
      );


    settings.playSounds =
      Boolean(
        result.formValues[5]
      );


    player.sendMessage(
      "§aGeneral settings saved."
    );


    await openSettingsMenu(
      player
    );
  } catch (error) {
    player.sendMessage(
      `§cGeneral settings error: ${error}`
    );

    console.warn(
      `[DeathReset] General settings error: ${error}`
    );
  }
}


// ============================================================
// EFFECT SETTINGS
// ============================================================

async function openEffectsSettings(player) {
  const form =
    new ModalFormData();

  form.title(
    "DeathReset Effects"
  );


  for (const effect of EFFECT_ROWS) {
    const config =
      settings.effects[
        effect.key
      ];


    form.toggle(
      `${effect.label} - Enabled`,
      {
        defaultValue:
          config.enabled,
      }
    );


    form.slider(
      `${effect.label} - Amplifier`,
      0,
      255,
      {
        defaultValue:
          config.amplifier,

        valueStep: 1,
      }
    );
  }


  try {
    const result =
      await form.show(player);


    if (result.canceled) {
      await openSettingsMenu(
        player
      );

      return;
    }


    let index = 0;


    for (const effect of EFFECT_ROWS) {
      settings.effects[
        effect.key
      ].enabled =
        Boolean(
          result.formValues[index]
        );

      index++;


      settings.effects[
        effect.key
      ].amplifier =
        Number(
          result.formValues[index] ?? 0
        );

      index++;
    }


    player.sendMessage(
      "§aEffect settings saved."
    );


    await openSettingsMenu(
      player
    );
  } catch (error) {
    player.sendMessage(
      `§cEffects settings error: ${error}`
    );

    console.warn(
      `[DeathReset] Effects settings error: ${error}`
    );
  }
}


// ============================================================
// COMMAND REGISTRATION
// ============================================================

system.beforeEvents.startup.subscribe(
  ({ customCommandRegistry }) => {

    // ========================================================
    // /deathreset:main
    // ========================================================

    customCommandRegistry.registerCommand(
      {
        name:
          "deathreset:main",

        description:
          "Start a DeathReset session.",

        permissionLevel:
          CommandPermissionLevel.Any,

        cheatsRequired:
          false,

        mandatoryParameters: [
          {
            name: "player",
            type:
              CustomCommandParamType.String,
          },

          {
            name: "x",
            type:
              CustomCommandParamType.Integer,
          },

          {
            name: "y",
            type:
              CustomCommandParamType.Integer,
          },

          {
            name: "z",
            type:
              CustomCommandParamType.Integer,
          },

          {
            name: "seconds",
            type:
              CustomCommandParamType.Integer,
          },
        ],
      },


      (
        origin,
        playerName,
        x,
        y,
        z,
        seconds
      ) => {

        const sourcePlayer =
          getSourcePlayer(
            origin
          );


        const isCommandBlock =
          Boolean(
            origin.sourceBlock
          );


        if (
          !isCommandBlock &&
          !isTrustedPlayer(
            sourcePlayer
          )
        ) {
          return {
            status:
              CustomCommandStatus.Failure,

            message:
              "You do not have permission to use DeathReset.",
          };
        }


        system.run(() => {
          const target =
            world
              .getPlayers()
              .find(
                (player) =>
                  player.name ===
                  String(playerName)
              );


          if (!target) {
            if (sourcePlayer) {
              sourcePlayer.sendMessage(
                `§cDeathReset: Player "${playerName}" was not found.`
              );
            }

            return;
          }


          const success =
            startReset(
              target,
              Number(x),
              Number(y),
              Number(z),
              Number(seconds)
            );


          if (
            !success &&
            sourcePlayer
          ) {
            sourcePlayer.sendMessage(
              "§cDeathReset: That player is already in a reset."
            );
          }
        });


        return {
          status:
            CustomCommandStatus.Success,
        };
      }
    );


    // ========================================================
    // /deathreset:settings
    // ========================================================

    customCommandRegistry.registerCommand(
      {
        name:
          "deathreset:settings",

        description:
          "Open DeathReset settings.",

        permissionLevel:
          CommandPermissionLevel.Any,

        cheatsRequired:
          false,
      },


      (origin) => {
        const sourcePlayer =
          getSourcePlayer(
            origin
          );


        if (
          !isTrustedPlayer(
            sourcePlayer
          )
        ) {
          return {
            status:
              CustomCommandStatus.Failure,

            message:
              "Only operators or trusted players can open DeathReset settings.",
          };
        }


        system.run(() => {
          openSettingsMenu(
            sourcePlayer
          );
        });


        return {
          status:
            CustomCommandStatus.Success,
        };
      }
    );
  }
);


// ============================================================
// PLAYER LEAVE CLEANUP
// ============================================================

world.afterEvents.playerLeave.subscribe(
  (event) => {
    const session =
      activeSessions.get(
        event.playerName
      );


    if (!session) {
      return;
    }


    system.clearRun(
      session.intervalId
    );


    activeSessions.delete(
      event.playerName
    );
  }
);