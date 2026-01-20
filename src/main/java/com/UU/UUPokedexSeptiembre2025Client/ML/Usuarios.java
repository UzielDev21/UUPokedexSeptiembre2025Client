package com.UU.UUPokedexSeptiembre2025Client.ML;

import com.fasterxml.jackson.annotation.JsonProperty;

public class Usuarios {

    private int user_Id;
    private String userName;
    private String email;
    private String password_Hash;
    private int active;
    private int is_Verified;

    @JsonProperty("RolesJPA")
    public Roles role_Id; // Recordar que es una propiedad de navegación

    private String nombre;
    private String apellidoPaterno;
    private String apellidoMaterno;
    private String sexo;

    public Usuarios() {
    }

    public Usuarios(int user_Id, String userName, String email, String password_Hash, int active, int is_Verified, Roles role_id, String nombre, String apellidoPaterno, String apellidoMaterno, String sexo) {

        this.user_Id = user_Id;
        this.userName = userName;
        this.email = email;
        this.password_Hash = password_Hash;
        this.active = active;
        this.is_Verified = is_Verified;
        this.role_Id = role_id;
        this.nombre = nombre;
        this.apellidoPaterno = apellidoPaterno;
        this.apellidoMaterno = apellidoMaterno;
        this.sexo = sexo;
    }

    public int getUser_Id() {
        return user_Id;
    }

    public void setUser_Id(int user_id) {
        this.user_Id = user_id;
    }

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword_Hash() {
        return password_Hash;
    }

    public void setPassword_Hash(String password_Hash) {
        this.password_Hash = password_Hash;
    }

    public int getActive() {
        return active;
    }

    public void setActive(int active) {
        this.active = active;
    }

    public int getIs_Verified() {
        return is_Verified;
    }

    public void setIs_Verified(int is_Verified) {
        this.is_Verified = is_Verified;
    }

    public Roles getRole_Id() {
        return role_Id;
    }

    public void setRole_Id(Roles role_Id) {
        this.role_Id = role_Id;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getApellidoPaterno() {
        return apellidoPaterno;
    }

    public void setApellidoPaterno(String apellidoPaterno) {
        this.apellidoPaterno = apellidoPaterno;
    }

    public String getApellidoMaterno() {
        return apellidoMaterno;
    }

    public void setApellidoMaterno(String apellidoMaterno) {
        this.apellidoMaterno = apellidoMaterno;
    }

    public String getSexo() {
        return sexo;
    }

    public void setSexo(String sexo) {
        this.sexo = sexo;
    }

}
