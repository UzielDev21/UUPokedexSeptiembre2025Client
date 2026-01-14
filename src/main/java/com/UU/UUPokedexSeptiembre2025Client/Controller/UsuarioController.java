package com.UU.UUPokedexSeptiembre2025Client.Controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class UsuarioController {

    @GetMapping("/user-details")
    public String pokedex() {
        return "userdetails";
    }

}
