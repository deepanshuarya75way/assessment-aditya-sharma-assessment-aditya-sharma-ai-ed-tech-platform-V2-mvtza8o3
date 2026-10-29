from pwdlib import PasswordHash

password_hasher = PasswordHash.recommended()
def hash_password(password):
    return password_hasher.hash(password)

def verify_password(plain_password, hashed_password):
    return password_hasher.verify(plain_password, hashed_password)


