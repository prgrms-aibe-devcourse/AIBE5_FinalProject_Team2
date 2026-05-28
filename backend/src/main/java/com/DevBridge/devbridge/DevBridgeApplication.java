package com.DevBridge.devbridge;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing
public class DevBridgeApplication {

    public static void main(String[] args) {
        SpringApplication.run(DevBridgeApplication.class, args);
    }

}
