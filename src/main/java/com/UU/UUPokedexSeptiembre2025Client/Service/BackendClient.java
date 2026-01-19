package com.UU.UUPokedexSeptiembre2025Client.Service;

import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BackendClient {

    private final RestTemplate restTemplate = new RestTemplate();
    private final String baseUrl = "http://localhost:8080";

    public String getError() {

        try {
            return restTemplate.getForObject(baseUrl + "/api/pokedex/...", String.class);
        } catch (HttpStatusCodeException ex) {
            HttpStatusCode code = ex.getStatusCode();
            throw new ResponseStatusException(code);
        }
    }
}
