package com.UU.UUPokedexSeptiembre2025Client.Controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class ViewController {

    @GetMapping("/login")
    public String login() {
        return "login";
    }
    @GetMapping("/pokedex")
    public String pokedex() {
        return "pokedex";
    }
}
