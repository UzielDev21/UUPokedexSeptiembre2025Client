package com.UU.UUPokedexSeptiembre2025Client.Controller;

import com.UU.UUPokedexSeptiembre2025Client.ML.Result;
import jakarta.servlet.http.HttpSession;
import java.util.HashMap;
import java.util.Map;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.client.RestTemplate;

@Controller
@RequestMapping("api")
public class LoginController {

    private static final String urlBase = "http://localhost:8080";

    @GetMapping("/login")
    public String login() {
        return "login";
    }

    @PostMapping("/login")
    public String login(@RequestParam("userName") String userName,
            @RequestParam("password_Hash") String password_Hash,
            Model model, HttpSession session) {

   
        Map<String, String> datos = new HashMap<>();
        datos.put("userName", userName);
        datos.put("password_Hash", password_Hash);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        RestTemplate restTemplate = new RestTemplate();
        HttpEntity<Map<String, String>> requestEntity = new HttpEntity<>(datos, headers);

        try {

            ResponseEntity<Result<String>> responseEntity = restTemplate.exchange(
                    urlBase + "/api/login",
                    HttpMethod.POST,
                    requestEntity,
                    new ParameterizedTypeReference<Result<String>>() {
            });

            int status = responseEntity.getStatusCode().value();

            if (status == 200) {

                Result<String> result = responseEntity.getBody();

                if (result != null && Boolean.TRUE.equals(result.correct)) {
                    String jwt = result.object;

                    session.setAttribute("jwtToken", jwt);
                    session.setAttribute("loggedUsername", userName);

                    Map<String, Object> claims = decodeJwt(jwt);

                    if (claims != null) {

                        String rol = (String) claims.get("rol");
                        Integer user_Id = null;
                        Object idObject = claims.get("user_Id");

                        if (idObject instanceof Integer) {

                            user_Id = (Integer) idObject;

                        } else if (idObject instanceof Number) {

                            user_Id = ((Number) (idObject)).intValue();
                        }

                        session.setAttribute("rol", rol);
                        session.setAttribute("user_Id", user_Id);

                        if ("Profesor".equalsIgnoreCase(rol)
                                || "Entrenador".equalsIgnoreCase(rol)) {

                            return "redirect:/pokedex";
                        }

                    } else {
                        model.addAttribute("error", "No se pudo leer el token correctamente");
                        return "login";
                    }

                } else {
                    String msgError;

                    if (result != null && result.errorMessage != null) {

                        msgError = result.errorMessage;

                    } else {
                        msgError = "Error al iniciar la sesión";
                    }
                    model.addAttribute("error", msgError);
                    return "login";
                }

            } else if (status == 401) {
                Result<String> result = responseEntity.getBody();
                String msgError;

                if (result != null && result.errorMessage != null) {

                    msgError = result.errorMessage;

                } else {
                    msgError = "Credenciales invalidas";

                }
                model.addAttribute("error", msgError);
                return "login";

            } else {
                String msgError = "Error al comunicarse al servidor. (" + status + ")";
                model.addAttribute("error", msgError);
                return "login";
            }
        } catch (Exception ex) {
            String msgError = "Error al comunicarse al servidor: " + ex.getLocalizedMessage();
            model.addAttribute("error", msgError);
        }
        return "login";
    }

    private Map<String, Object> decodeJwt(String jwt) {
        Result result = new Result();

        try {
            String[] parts = jwt.split("\\.");

            if (parts.length < 2) {
                return (Map<String, Object>) result;
            }

            String payload = new String(
                    java.util.Base64.getUrlDecoder().decode(parts[1]),
                    java.nio.charset.StandardCharsets.UTF_8
            );

            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return mapper.readValue(payload, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {
            });

        } catch (Exception ex) {
            result.correct = false;
            result.errorMessage = ex.getLocalizedMessage();
            result.ex = ex;
            return null;
        }

    }

}
