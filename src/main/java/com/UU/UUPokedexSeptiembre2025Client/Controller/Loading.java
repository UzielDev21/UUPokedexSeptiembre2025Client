package com.UU.UUPokedexSeptiembre2025Client.Controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
@RequestMapping("loading")
public class Loading {

    @GetMapping("/show")
    public String showLoading(
            @RequestParam(name = "redirectTo", required = false) String redirectTo,
            @RequestParam(name = "message", defaultValue = "Cargando...") String message,
            Model model) {
        
        model.addAttribute("redirectUrl", redirectTo != null ? redirectTo: "/pokedex");
        model.addAttribute("loadingMessage", message);
        model.addAttribute("duration", 2000);

        return "loading";
    }

}
