package com.DevBridge.devbridge.domain.user.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * DB의 기존 'CLIENT'/'PARTNER' 값과 신규 'USER'/'PRO' 값을 모두 읽을 수 있도록 하는 JPA 컨버터.
 * 쓸 때는 항상 'USER'/'PRO'로 저장한다.
 */
@Converter
public class UserTypeConverter implements AttributeConverter<User.UserType, String> {

    @Override
    public String convertToDatabaseColumn(User.UserType attribute) {
        if (attribute == null) return null;
        return attribute.name();
    }

    @Override
    public User.UserType convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        return switch (dbData.toUpperCase()) {
            case "CLIENT", "USER" -> User.UserType.USER;
            case "PARTNER", "PRO" -> User.UserType.PRO;
            default -> User.UserType.USER;
        };
    }
}
