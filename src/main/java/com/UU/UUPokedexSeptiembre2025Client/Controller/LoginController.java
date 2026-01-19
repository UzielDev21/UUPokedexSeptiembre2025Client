package com.UU.UUPokedexSeptiembre2025Client.Controller;

import com.UU.UUPokedexSeptiembre2025Client.ML.Result;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
@RequestMapping("auth")
public class LoginController {

    /*
        *Url del Backend Real
     */
    private static final String urlBase = "http://localhost:8080";

    /*
        *Metodo implementado con GetMappin para el renderizado general del login
     */
    @GetMapping("/login")
    public String login() {
        return "login";
    }

    /*
        *aunque este metodo se llame igual que el metodo anterior
        *No afecta por el manejo diferente de la anotació
    ---------------------------------------------------------------
        *Manejo Post en formulario para validar el usuario y password
     */
    @PostMapping("/login")
    public String login(
            @RequestParam("userName") String userName,
            @RequestParam("password_Hash") String password_Hash,
            Model model,
            HttpSession session) {

        // =========================
        // Construir JSON a enviar
        // =========================
        Map<String, String> datos = new HashMap<>();
        datos.put("userName", userName);
        datos.put("password_Hash", password_Hash);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, String>> requestEntity
                = new HttpEntity<>(datos, headers);

        RestTemplate restTemplate = new RestTemplate();

        try {
            // =========================
            // Llamada al backend JWT
            // =========================
            ResponseEntity<Result<String>> responseEntity
                    = restTemplate.exchange(
                            urlBase + "/api/login",
                            HttpMethod.POST,
                            requestEntity,
                            new ParameterizedTypeReference<Result<String>>() {
                    }
                    );

            Result<String> result = responseEntity.getBody();

            // =========================
            // Login correcto
            // =========================
            if (result != null && Boolean.TRUE.equals(result.correct)) {

                String jwt = result.object;

                // Guardar token y usuario en sesión
                session.setAttribute("jwtToken", jwt);
                session.setAttribute("loggedUsername", userName);

                // Decodificar JWT
                Map<String, Object> claims = decodeJwt(jwt);
                if (claims == null) {
                    model.addAttribute(
                            "loginErrorMessage",
                            "No se pudo procesar el token de autenticación"
                    );
                    return "login";
                }

                String rol = (String) claims.get("rol");
                Object idObject = claims.get("user_Id");
                Integer user_Id = null;

                if (idObject instanceof Number) {
                    user_Id = ((Number) idObject).intValue();
                }

                session.setAttribute("rol", rol);
                session.setAttribute("user_Id", user_Id);

                // =========================
                // Redirección por rol
                // =========================
                if ("Profesor".equalsIgnoreCase(rol)
                        || "Entrenador".equalsIgnoreCase(rol)) {
                    return "redirect:/loading/show?redirectTo=/pokedex";
                }

                // Rol no permitido
                model.addAttribute(
                        "loginErrorMessage",
                        "No tienes permisos para acceder"
                );
                return "login";
            }

            // Caso raro: 200 pero correct=false
            model.addAttribute(
                    "loginErrorMessage",
                    "Error al iniciar sesión, intenta nuevamente"
            );
            return "login";

        } // =========================
        // Errores 401 y 403
        // =========================
        catch (HttpClientErrorException ex) {

            int status = ex.getStatusCode().value();
            String body = ex.getResponseBodyAsString();

            if (status == 403) {
                model.addAttribute(
                        "loginErrorMessage",
                        "Acceso denegado"
                );
                return "login";
            }

            if (status == 401) {

                if (body != null && !body.isBlank()) {
                    try {
                        ObjectMapper mapper = new ObjectMapper();
                        Result<?> result = mapper.readValue(body, Result.class);

                        if (result != null
                                && result.errorMessage != null
                                && !result.errorMessage.isBlank()) {

                            model.addAttribute(
                                    "loginErrorMessage",
                                    result.errorMessage
                            );
                            return "login";
                        }
                    } catch (Exception ignored) {

                    }
                }

                model.addAttribute(
                        "loginErrorMessage",
                        "Credenciales incorrectas. Verifica tu usuario y contraseña."
                );
                return "login";
            }

            // Otros 40x
            model.addAttribute(
                    "loginErrorMessage",
                    "Error al iniciar sesión (" + status + ")"
            );
            return "login";
        } // =========================
        // Error 5xx backend
        // =========================
        catch (HttpServerErrorException ex) {
            model.addAttribute(
                    "loginErrorMessage",
                    "El servicio no está disponible, intenta más tarde"
            );
            return "login";
        } // =========================
        // Error de conexión o timeout
        // =========================
        catch (ResourceAccessException ex) {
            model.addAttribute(
                    "loginErrorMessage",
                    "No se pudo conectar con el servidor de autenticación"
            );
            return "login";
        } // =========================
        // Error inesperado
        // =========================
        catch (Exception ex) {
            model.addAttribute(
                    "loginErrorMessage",
                    "Error inesperado al iniciar sesión"
            );
            return "login";
        }
    }

    @PostMapping("/logout")
    public String logout(HttpSession session, RedirectAttributes redirectAttributes) {

        String token = (String) session.getAttribute("jwtToken");

        if (token == null) {
            redirectAttributes.addFlashAttribute("error", "No hay sesión activa");
            return "redirect:/auth/login";
        }

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + token);
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<?> entity = new HttpEntity<>(headers);
        RestTemplate restTemplate = new RestTemplate();

        try {

            ResponseEntity<Result<String>> responseEntity = restTemplate.exchange(
                    urlBase + "/api/logout",
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<Result<String>>() {
            });

            if (responseEntity.getStatusCode().value() == 200) {

                Result<String> result = responseEntity.getBody();

                if (result != null && Boolean.TRUE.equals(result.correct)) {

                    session.invalidate();
                    redirectAttributes.addFlashAttribute("msgLogout", "Sesión cerrada");

                    return "redirect:/auth/login";
                }
            }

            redirectAttributes.addFlashAttribute("msgError", "No se pudo cerrar sesión");

        } catch (Exception ex) {
            redirectAttributes.addFlashAttribute("msgError", "Error logout; " + ex.getLocalizedMessage());
        }
        return "redirect:/auth/login";
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
