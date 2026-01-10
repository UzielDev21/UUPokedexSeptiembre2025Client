package com.UU.UUPokedexSeptiembre2025Client.Controller;

import com.UU.UUPokedexSeptiembre2025Client.DTO.PokedexResponseDTO;
import jakarta.servlet.http.HttpSession;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

@Controller
@RequestMapping("/pokedex")
public class PokedexController {

    @Value("${pokedex.service.base-url:http://localhost:8080}")
    private String serviceBaseUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    private static final Set<String> ALLOWED_SORT = Set.of(
            "id_asc", "id_desc", "name_asc", "name_desc"
    );

    @GetMapping
    public String getAll(
            @RequestParam(name = "sear", required = false) String sear,
            @RequestParam(name = "type", required = false) String type,
            @RequestParam(name = "limit", defaultValue = "12") int limit,
            @RequestParam(name = "offset", defaultValue = "0") int offset,
            @RequestParam(name = "sort", defaultValue = "id_asc") String sort,
            Model model,
            HttpSession session
    ) {

        // 1) Normalización / validación
        sear = (sear == null) ? "" : sear.trim();
        type = (type == null) ? "" : type.trim();

        // limit 1..48
        limit = Math.max(1, Math.min(48, limit));
        // offset >= 0
        offset = Math.max(0, offset);
        // sort válido
        sort = normalizeSort(sort);

        // 2) Construir URL hacia el Service
        String url = UriComponentsBuilder
                .fromUriString(serviceBaseUrl + "/api/pokedex")
                .queryParam("sear", sear)
                .queryParam("type", type)
                .queryParam("limit", limit)
                .queryParam("offset", offset)
                .queryParam("sort", sort)
                .toUriString();

        // 3) Headers (JSON + Bearer si existe)
        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        Object token = session.getAttribute("jwtToken");
        if (token != null && !token.toString().isBlank()) {
            headers.setBearerAuth(token.toString());
        }

        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<PokedexResponseDTO> resp = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    entity,
                    PokedexResponseDTO.class
            );

            if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                PokedexResponseDTO data = resp.getBody();

                // 4) Pasar datos a la vista
                model.addAttribute("pokes", data.pokes());
                model.addAttribute("count", data.count());
                model.addAttribute("hasNext", data.hasNext());
                model.addAttribute("hasPrev", data.hasPrev());

            } else {
                model.addAttribute("pokes", List.of());
                model.addAttribute("count", 0);
                model.addAttribute("hasNext", false);
                model.addAttribute("hasPrev", false);
                model.addAttribute("errorMessage", "El Service respondió sin datos.");
            }

        } catch (RestClientResponseException ex) {
            // Error HTTP del Service (400/401/500, etc.)
            model.addAttribute("pokes", List.of());
            model.addAttribute("count", 0);
            model.addAttribute("hasNext", false);
            model.addAttribute("hasPrev", false);
            model.addAttribute("errorMessage",
                    "Error del Service (" + ex.getLocalizedMessage()+ "): " + ex.getStatusText());
        } catch (Exception ex) {
            // Error general (conexión, parsing, etc.)
            model.addAttribute("pokes", List.of());
            model.addAttribute("count", 0);
            model.addAttribute("hasNext", false);
            model.addAttribute("hasPrev", false);
            model.addAttribute("errorMessage",
                    "No se pudo consultar el Service: " + ex.getMessage());
        }

        // 5) Mantener parámetros en la vista (para paginación / filtros)
        model.addAttribute("sear", sear);
        model.addAttribute("type", type);
        model.addAttribute("limit", limit);
        model.addAttribute("offset", offset);
        model.addAttribute("sort", sort);

        return "pokedex";
    }

    private String normalizeSort(String sort) {
        if (sort == null) return "id_asc";
        sort = sort.trim().toLowerCase();
        return ALLOWED_SORT.contains(sort) ? sort : "id_asc";
    }
}
