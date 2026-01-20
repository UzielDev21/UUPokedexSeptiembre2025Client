package com.UU.UUPokedexSeptiembre2025Client.Controller;

import com.UU.UUPokedexSeptiembre2025Client.ML.Result;
import com.UU.UUPokedexSeptiembre2025Client.ML.Roles;
import jakarta.servlet.http.HttpSession;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.client.RestTemplate;

@Controller
@RequestMapping("usuario")
public class UsuarioController {

    private static final String urlBase = "http://localhost:8080";

    /**
     * -------------------------------------------------------------------------
     * METODO ENCARGADO DE REALIZAR EL RENDERIZADO DE LA VISTA DETALLES USUARIO
     * -------------------------------------------------------------------------
     */
    @GetMapping("/details")
    public String pokedex(Model model, HttpSession session) {

        String user = (String) session.getAttribute("loggedUsername");
        model.addAttribute("UsuarioLogueado", user);

        return "userdetails";
    }

    /**
     * ---------------------------------------------------------------------------
     * METODO RESPONSABLE DE RENDERIZAR EL FORMULARIO PARA EL REGISTRO DEL
     * USUARIO
     * ---------------------------------------------------------------------------
     */
    @GetMapping("/registrar")
    public String registroUser(Model model, HttpSession session) {

        //Aqui extraigo el token para el usuario loggeado
        String token = (String) session.getAttribute("jwtToken");

        //carga el usuario para renderizarlo en el layout
        String user = (String) session.getAttribute("loggedUsername");
        model.addAttribute("UsuarioLogueado", user);

        if (token != null && !token.isEmpty()) {

            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + token);
            HttpEntity<?> entity = new HttpEntity<>(headers);

            RestTemplate restTemplate = new RestTemplate();

            try {
                ResponseEntity<Result<Roles>> responseEntityRoles = restTemplate.exchange(
                        urlBase + "/roles",
                        HttpMethod.GET,
                        entity,
                        new ParameterizedTypeReference<Result<Roles>>() {
                });

                if (responseEntityRoles.getStatusCode().value() == 200) {

                    Result resultRol = responseEntityRoles.getBody();
                    model.addAttribute("Roles", resultRol.objects);

                } else {
                    return "error";
                }

            } catch (Exception ex) {
                System.out.println("Usuario sin authorización" + ex.getLocalizedMessage());

            }
        }
        return "registroUser";
    }

}
