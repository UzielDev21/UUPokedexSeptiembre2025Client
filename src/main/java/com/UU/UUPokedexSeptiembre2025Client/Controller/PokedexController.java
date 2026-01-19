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
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
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

        sear = (sear == null) ? "" : sear.trim();
        type = (type == null) ? "" : type.trim();

        limit = Math.max(1, Math.min(48, limit));
        offset = Math.max(0, offset);
        sort = normalizeSort(sort);

        String url = UriComponentsBuilder
                .fromUriString(serviceBaseUrl + "/api/pokedex")
                .queryParam("sear", sear)
                .queryParam("type", type)
                .queryParam("limit", limit)
                .queryParam("offset", offset)
                .queryParam("sort", sort)
                .toUriString();

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

            // OK pero sin body => error del gateway
            if (resp.getBody() == null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "El Service respondió sin datos."
                );
            }

            // OK
            PokedexResponseDTO data = resp.getBody();
            model.addAttribute("pokes", data.pokes());
            model.addAttribute("count", data.count());
            model.addAttribute("hasNext", data.hasNext());
            model.addAttribute("hasPrev", data.hasPrev());

            // filtros/params para mantener el estado en la vista
            model.addAttribute("sear", sear);
            model.addAttribute("type", type);
            model.addAttribute("limit", limit);
            model.addAttribute("offset", offset);
            model.addAttribute("sort", sort);

            String user = (String) session.getAttribute("loggedUsername");
            model.addAttribute("UsuarioLogueado", user);

            return "pokedex";

        } catch (RestClientResponseException ex) {
            // ✅ BACK devolvió status HTTP real (401/403/404/500/etc)
            HttpStatusCode statusCode = ex.getStatusCode();
            int code = statusCode.value();

            if (code == 401) {
                // token inválido/expirado => limpiar sesión
                session.removeAttribute("jwtToken");
                session.removeAttribute("loggedUsername");
            }

            // Opcional: si el backend manda mensaje en el body
            String backendMsg = ex.getResponseBodyAsString();
            String reason = "Error del Service: " + ex.getStatusText();
            if (backendMsg != null && !backendMsg.isBlank()) {
                reason += " - " + backendMsg;
            }

            throw new ResponseStatusException(statusCode, reason, ex);

        } catch (ResourceAccessException ex) {
            // ✅ No conectó al BACK (timeout, connection refused, etc)
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "No se pudo consultar el Service (¿está encendido el backend?).",
                    ex
            );

        } catch (ResponseStatusException ex) {
            // ✅ si ya lanzamos un ResponseStatusException arriba, no lo conviertas a 503
            throw ex;

        } catch (Exception ex) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Error inesperado en el cliente.",
                    ex
            );
        }
    }

    private String normalizeSort(String sort) {
        if (sort == null) {
            return "id_asc";
        }
        sort = sort.trim().toLowerCase();
        return ALLOWED_SORT.contains(sort) ? sort : "id_asc";
    }
}
