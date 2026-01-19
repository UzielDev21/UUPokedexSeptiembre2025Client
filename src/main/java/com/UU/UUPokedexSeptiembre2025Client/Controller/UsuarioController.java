package com.UU.UUPokedexSeptiembre2025Client.Controller;

import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
@RequestMapping("usuario")
public class UsuarioController {

    @GetMapping("/details")
    public String pokedex(Model model, HttpSession session) {

        String user = (String) session.getAttribute("loggedUsername");
        model.addAttribute("UsuarioLogueado", user);

        return "userdetails";
    }

    @GetMapping("/registrar")
    public String registroUser(Model model, HttpSession session) {

        String user = (String) session.getAttribute("loggedUsername");
        model.addAttribute("UsuarioLogueado", user);

        return "registroUser";
    }

}
