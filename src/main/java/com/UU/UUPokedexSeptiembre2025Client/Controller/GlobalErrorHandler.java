package com.UU.UUPokedexSeptiembre2025Client.Controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@ControllerAdvice
public class GlobalErrorHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public String handleResponseStatus(ResponseStatusException ex, HttpServletRequest req, Model model) {
        int status = ex.getStatusCode().value();
        return render(model, req, status, ex.getReason());
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public String handleNoResource(NoResourceFoundException ex, HttpServletRequest req, Model model) {
        return render(model, req, 404, "La página no existe o fue movida.");
    }

    @ExceptionHandler(Exception.class)
    public String handleAny(Exception ex, HttpServletRequest req, Model model) {
        return render(model, req, 500, "Ocurrió un problema inesperado.");
    }

    private String render(Model model, HttpServletRequest req, int status, String reason) {

        String title;
        String description;

        switch (status) {
            case 404:
                title = "404 - No encontrado";
                description = (reason != null && !reason.isBlank())
                        ? reason
                        : "La página no existe o fue movida.";
                break;
            case 403:
                title = "403 - Sin permisos";
                description = (reason != null && !reason.isBlank())
                        ? reason
                        : "No tienes autorización para acceder a este recurso.";
                break;
            case 401:
                title = "401 - No autenticado";
                description = (reason != null && !reason.isBlank())
                        ? reason
                        : "Necesitas iniciar sesión para continuar.";
                break;
            case 503:
                title = "503 - Servicio no disponible";
                description = (reason != null && !reason.isBlank())
                        ? reason
                        : "No se pudo conectar con el servicio. Intenta más tarde.";
                break;
            case 502:
                title = "502 - Error de gateway";
                description = (reason != null && !reason.isBlank())
                        ? reason
                        : "Respuesta inválida del servicio.";
                break;
            case 400:
                title = "400 - Petición inválida";
                description = (reason != null && !reason.isBlank())
                        ? reason
                        : "La solicitud no es válida.";
                break;
            default:
                title = status + " - Error";
                description = (reason != null && !reason.isBlank())
                        ? reason
                        : "Ocurrió un problema inesperado.";
                break;
        }

        model.addAttribute("status", status);
        model.addAttribute("title", title);
        model.addAttribute("description", description);
        model.addAttribute("path", req.getRequestURI());

        return "error";
    }
}
