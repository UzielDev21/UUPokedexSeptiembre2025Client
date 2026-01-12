package com.UU.UUPokedexSeptiembre2025Client.DTO;

import java.util.List;

public record PokemonVistaDTO(
        int id,
        String name,
        List<String> types,
        int hp,
        int atk,
        int def,
        int spAtk,
        int spDef,
        int speed,
        String spriteUrl
) {}
