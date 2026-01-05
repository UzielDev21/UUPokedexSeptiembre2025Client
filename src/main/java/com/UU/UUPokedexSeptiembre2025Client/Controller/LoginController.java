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
                
                if (result != null && Boolean.TRUE.equals(result.correct))  {
                    String jwt = result.object;
                    
                    session.setAttribute("jwtToken", jwt);
                    session.setAttribute("loggedUsername", userName);
                    
                    Map<String, Object> claims = decodeJwt(jwt);
                }
                
            }
            
        } catch (Exception e) {
        }
        return null;
    }
    
    private Map<String, Object> decodeJwt(String jwt){
        Result result = new Result();
        
        try {
            String [] parts = jwt.split("\\.");
            
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
