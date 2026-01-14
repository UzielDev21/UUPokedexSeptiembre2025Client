package com.UU.UUPokedexSeptiembre2025Client.Controller;

import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class UsuarioController {

    @GetMapping("/user-details")
    public String pokedex(Model model, HttpSession session) {
        
        String user = (String) session.getAttribute("loggedUsername");
        model.addAttribute("UsuarioLogueado", user);
        
        return "userdetails";
    }

}
