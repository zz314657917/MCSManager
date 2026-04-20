package com.mcsmanager.monitor;

import org.bukkit.Material;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.PlayerInventory;
import org.bukkit.inventory.meta.ItemMeta;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class InventorySnapshotAdapter {
    ActionResult snapshot(Player player) {
        if (player == null || !player.isOnline()) {
            return ActionResult.error(409, "Player must be online to read inventory.");
        }

        PlayerInventory inventory = player.getInventory();
        LinkedHashMap<String, Object> data = new LinkedHashMap<String, Object>();
        data.put("playerUuid", player.getUniqueId().toString());
        data.put("playerName", player.getName());
        data.put("online", Boolean.TRUE);
        data.put("source", "bukkit");
        data.put("updatedAt", Long.valueOf(System.currentTimeMillis()));
        data.put("slots", buildSlots(inventory));
        return ActionResult.success("Player inventory snapshot loaded.", data);
    }

    private List<Map<String, Object>> buildSlots(PlayerInventory inventory) {
        List<Map<String, Object>> slots = new ArrayList<Map<String, Object>>();

        for (int slot = 0; slot < 9; slot++) {
            slots.add(serializeSlot("hotbar", slot, inventory.getItem(slot)));
        }

        for (int slot = 9; slot < 36; slot++) {
            slots.add(serializeSlot("main", slot - 9, inventory.getItem(slot)));
        }

        ItemStack[] armorContents = inventory.getArmorContents();
        slots.add(serializeSlot("armor", 0, getArmorItem(armorContents, 3)));
        slots.add(serializeSlot("armor", 1, getArmorItem(armorContents, 2)));
        slots.add(serializeSlot("armor", 2, getArmorItem(armorContents, 1)));
        slots.add(serializeSlot("armor", 3, getArmorItem(armorContents, 0)));

        slots.add(serializeSlot("offhand", 0, inventory.getItemInOffHand()));
        return slots;
    }

    private ItemStack getArmorItem(ItemStack[] armorContents, int index) {
        if (armorContents == null || index < 0 || index >= armorContents.length) {
            return null;
        }
        return armorContents[index];
    }

    private Map<String, Object> serializeSlot(String section, int slot, ItemStack item) {
        LinkedHashMap<String, Object> data = new LinkedHashMap<String, Object>();
        data.put("section", section);
        data.put("slot", Integer.valueOf(slot));

        if (isEmpty(item)) {
            data.put("empty", Boolean.TRUE);
            return data;
        }

        Material material = item.getType();
        data.put("empty", Boolean.FALSE);
        data.put("material", material.name());
        data.put("rawTypeName", material.name());
        data.put("amount", Integer.valueOf(item.getAmount()));

        int maxDurability = material.getMaxDurability();
        if (maxDurability > 0) {
            data.put("durability", Integer.valueOf(item.getDurability()));
            data.put("maxDurability", Integer.valueOf(maxDurability));
        }

        ItemMeta meta = item.hasItemMeta() ? item.getItemMeta() : null;
        if (meta != null) {
            if (meta.hasDisplayName()) {
                data.put("displayName", meta.getDisplayName());
            }
            if (meta.hasLore() && meta.getLore() != null && !meta.getLore().isEmpty()) {
                data.put("lore", new ArrayList<String>(meta.getLore()));
            }
            if (meta.hasEnchants()) {
                List<Map<String, Object>> enchants = new ArrayList<Map<String, Object>>();
                List<Map.Entry<Enchantment, Integer>> entries =
                        new ArrayList<Map.Entry<Enchantment, Integer>>(meta.getEnchants().entrySet());
                Collections.sort(entries, new Comparator<Map.Entry<Enchantment, Integer>>() {
                    @Override
                    public int compare(Map.Entry<Enchantment, Integer> left, Map.Entry<Enchantment, Integer> right) {
                        return safeEnchantKey(left.getKey()).compareToIgnoreCase(safeEnchantKey(right.getKey()));
                    }
                });
                for (Map.Entry<Enchantment, Integer> entry : entries) {
                    LinkedHashMap<String, Object> enchantData = new LinkedHashMap<String, Object>();
                    enchantData.put("key", safeEnchantKey(entry.getKey()));
                    enchantData.put("level", Integer.valueOf(entry.getValue() == null ? 0 : entry.getValue().intValue()));
                    enchants.add(enchantData);
                }
                if (!enchants.isEmpty()) {
                    data.put("enchants", enchants);
                }
            }
            if (!meta.getItemFlags().isEmpty()) {
                List<String> itemFlags = new ArrayList<String>();
                for (ItemFlag itemFlag : meta.getItemFlags()) {
                    itemFlags.add(itemFlag.name());
                }
                Collections.sort(itemFlags, String.CASE_INSENSITIVE_ORDER);
                data.put("itemFlags", itemFlags);
            }
        }

        return data;
    }

    private boolean isEmpty(ItemStack item) {
        return item == null || item.getType() == Material.AIR || item.getAmount() <= 0;
    }

    private String safeEnchantKey(Enchantment enchantment) {
        if (enchantment == null) {
            return "UNKNOWN";
        }
        String name = enchantment.getName();
        return name == null || name.trim().isEmpty() ? enchantment.toString() : name.trim();
    }
}
