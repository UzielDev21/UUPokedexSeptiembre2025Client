package com.UU.UUPokedexSeptiembre2025Client.DTO;

import java.util.List;

public record PokedexResponseDTO(
        List<PokemonVistaDTO> pokes,
        Integer count,
        boolean hasNext,
        boolean hasPrev
) {}
