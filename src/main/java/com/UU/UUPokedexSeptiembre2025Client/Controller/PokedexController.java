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
            @RequestParam(name = "id", required = false) Integer id,
            @RequestParam(name = "name", required = false) String name,
            @RequestParam(name = "type", required = false) String type,
            @RequestParam(name = "limit", defaultValue = "12") int limit,
            @RequestParam(name = "offset", defaultValue = "0") int offset,
            @RequestParam(name = "sort", defaultValue = "id_asc") String sort,
            Model model,
            HttpSession session
    ) {

        sear = (sear == null) ? "" : sear.trim();
        name = (name == null) ? "" : name.trim();
        type = (type == null) ? "" : type.trim();

        limit = Math.max(1, Math.min(48, limit));
        offset = Math.max(0, offset);
        sort = normalizeSort(sort);

        UriComponentsBuilder builder = UriComponentsBuilder
                .fromUriString(serviceBaseUrl + "/api/pokedex")
                .queryParam("limit", limit)
                .queryParam("offset", offset)
                .queryParam("sort", sort);

        if (id != null) {
            builder.queryParam("id", id);
        } else if (!name.isBlank()) {
            builder.queryParam("name", name);
        } else if (!sear.isBlank()) {
            builder.queryParam("sear", sear);
        }

        if (!type.isBlank()) {
            builder.queryParam("type", type);
        }

        String url = builder.toUriString();

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

            if (resp.getBody() == null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "El Service respondió sin datos."
                );
            }

            PokedexResponseDTO data = resp.getBody();
            model.addAttribute("pokes", data.pokes());
            model.addAttribute("count", data.count());
            model.addAttribute("hasNext", data.hasNext());
            model.addAttribute("hasPrev", data.hasPrev());

            model.addAttribute("sear", sear);
            model.addAttribute("id", id);
            model.addAttribute("name", name);
            model.addAttribute("type", type);
            model.addAttribute("limit", limit);
            model.addAttribute("offset", offset);
            model.addAttribute("sort", sort);

            String user = (String) session.getAttribute("loggedUsername");
            model.addAttribute("UsuarioLogueado", user);

            return "pokedex";

        } catch (RestClientResponseException ex) {
            HttpStatusCode statusCode = ex.getStatusCode();
            int code = statusCode.value();

            if (code == 401) {
                session.removeAttribute("jwtToken");
                session.removeAttribute("loggedUsername");
            }

            String backendMsg = ex.getResponseBodyAsString();
            String reason = "Error del Service: " + ex.getStatusText();
            if (backendMsg != null && !backendMsg.isBlank()) {
                reason += " - " + backendMsg;
            }

            throw new ResponseStatusException(statusCode, reason, ex);

        } catch (ResourceAccessException ex) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "No se pudo consultar el Service (¿está encendido el backend?).",
                    ex
            );

        } catch (ResponseStatusException ex) {
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

    @GetMapping("/data")
    @ResponseBody
    public ResponseEntity<PokedexResponseDTO> getData(
            @RequestParam(name = "id", required = false) Integer id,
            @RequestParam(name = "name", required = false) String name,
            @RequestParam(name = "type", required = false) String type,
            @RequestParam(name = "limit", defaultValue = "12") int limit,
            @RequestParam(name = "offset", defaultValue = "0") int offset,
            @RequestParam(name = "sort", defaultValue = "id_asc") String sort,
            HttpSession session
    ) {
        name = (name == null) ? "" : name.trim();
        type = (type == null) ? "" : type.trim();

        limit = Math.max(1, Math.min(48, limit));
        offset = Math.max(0, offset);
        sort = normalizeSort(sort);

        UriComponentsBuilder builder = UriComponentsBuilder
                .fromUriString(serviceBaseUrl + "/api/pokedex")
                .queryParam("limit", limit)
                .queryParam("offset", offset)
                .queryParam("sort", sort);

        if (id != null) {
            builder.queryParam("id", id);
        } else if (!name.isBlank()) {
            builder.queryParam("name", name);
        }

        if (!type.isBlank()) {
            builder.queryParam("type", type);
        }

        String url = builder.toUriString();

        HttpHeaders headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        Object token = session.getAttribute("jwtToken");
        if (token != null && !token.toString().isBlank()) {
            headers.setBearerAuth(token.toString());
        }

        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<PokedexResponseDTO> resp = restTemplate.exchange(
                    url, HttpMethod.GET, entity, PokedexResponseDTO.class
            );

            if (resp.getBody() == null) {
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
            }

            return ResponseEntity.ok(resp.getBody());

        } catch (RestClientResponseException ex) {
            return ResponseEntity.status(ex.getStatusCode()).build();
        } catch (ResourceAccessException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
    }

}
