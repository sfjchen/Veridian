import re

ROLE_STUDENT = "student"
ROLE_TEACHER = "teacher"
VALID_ROLES = (ROLE_TEACHER, ROLE_STUDENT)

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
MIN_PASSWORD_LENGTH = 8
