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

        String token = (String) session.getAttribute("jwtToken");

        /*
        aqui es donde se revisa la autorización del token
        no se restringe ya que todos tiene acceso a esta vista
        unicamente el usuario INVITADO, no se le renderizara
        el DDL en el formulario
         */
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + token);
        HttpEntity<?> entity = new HttpEntity<>(headers);

        /*
        aqui se hace la serialización para el consumo de la API
         */
        RestTemplate restTemplate = new RestTemplate();
        ResponseEntity<Result<Roles>> responseEntityRoles = restTemplate.exchange(
                urlBase,
                HttpMethod.GET,
                entity,
                new ParameterizedTypeReference<Result<Roles>>() {
        });

        if (responseEntityRoles.getStatusCode().value() == 200) {

            Result resultRol = responseEntityRoles.getBody();
            model.addAttribute("Roles", resultRol.objects);

            /*
                * Esta parte es la que renderiza el username del usuario loggeado
             */
            String user = (String) session.getAttribute("loggedUsername");
            model.addAttribute("UsuarioLogueado", user);

        } else {
            return "error";
        }

        return "registroUser";
    }

}
